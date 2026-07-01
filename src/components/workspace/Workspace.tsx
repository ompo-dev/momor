import React, { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { useWorkspaceTree, useWorkspaceActions } from "./useWorkspace";
import {
  compositeId,
  isFolderDescendantOf,
  nextSortOrder,
  orderableChildren,
  type ItemKind,
  type TreeItem,
} from "./tree-utils";
import WorkspaceSidebar from "./WorkspaceSidebar";
import NoteEditor from "./NoteEditor";
import MeetingNoteView from "./MeetingNoteView";
import McpEditor from "./McpEditor";
import SkillEditor from "./SkillEditor";

export type SelectionKind = "note" | "meeting" | "mcp" | "skill";

export interface WorkspaceSelection {
  id: string; // composite id
  kind: SelectionKind;
  refId: string;
}

export interface WorkspaceHandlers {
  selectItem: (item: TreeItem) => void;
  createNote: (parentFolderId: string | null) => void;
  createFolder: (parentFolderId: string | null) => void;
  renameItem: (item: TreeItem, name: string) => void;
  deleteItem: (item: TreeItem) => void;
  moveItem: (
    active: TreeItem,
    targetParentFolderId: string | null,
    after: TreeItem | null,
  ) => void;
}

const SIDEBAR_WIDTH_KEY = "momor_workspace_sidebar_width";
const COLLAPSED_KEY = "momor_workspace_collapsed";
const MIN_W = 200;
const MAX_W = 480;

interface WorkspaceProps {
  onOpenSettings: (tab?: string) => void;
  onOpenUserContext: () => void;
}

const Workspace: React.FC<WorkspaceProps> = ({
  onOpenSettings,
  onOpenUserContext,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { items } = useWorkspaceTree();
  const actions = useWorkspaceActions();

  const [selected, setSelected] = useState<WorkspaceSelection | null>(null);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });

  const persistCollapsed = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapse = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persistCollapsed(next);
        return next;
      });
    },
    [persistCollapsed],
  );

  const expandFolder = useCallback(
    (folderRefId: string) => {
      const cid = compositeId("folder", folderRefId);
      setCollapsed((prev) => {
        if (!prev.has(cid)) return prev;
        const next = new Set(prev);
        next.delete(cid);
        persistCollapsed(next);
        return next;
      });
    },
    [persistCollapsed],
  );

  // Allow other surfaces (e.g. the top search pill) to open a workspace item
  // without prop-drilling selection state up to the Launcher.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { kind: ItemKind; refId: string }
        | undefined;
      if (!detail) return;
      setSelected({
        id: compositeId(detail.kind, detail.refId),
        kind: detail.kind as SelectionKind,
        refId: detail.refId,
      });
    };
    window.addEventListener("momor-open-workspace-item", handler);
    return () => window.removeEventListener("momor-open-workspace-item", handler);
  }, []);

  // ── Selection ──────────────────────────────────────────────────
  const selectItem = useCallback(
    (item: TreeItem) => {
      if (item.kind === "folder") {
        toggleCollapse(item.id);
        return;
      }
      setSelected({
        id: item.id,
        kind: item.kind as SelectionKind,
        refId: item.refId,
      });
    },
    [toggleCollapse],
  );

  const selectAbility = useCallback((kind: "mcp" | "skill", refId: string) => {
    setSelected({ id: `${kind}:${refId}`, kind, refId });
  }, []);

  // ── Create ─────────────────────────────────────────────────────
  const createNote = useCallback(
    async (parentFolderId: string | null) => {
      const res = await actions.createNote.mutateAsync({
        folderId: parentFolderId,
        sortOrder: nextSortOrder(items, parentFolderId),
        title: "Untitled",
      });
      if (parentFolderId) expandFolder(parentFolderId);
      if (res?.id) {
        setSelected({
          id: compositeId("note", res.id),
          kind: "note",
          refId: res.id,
        });
      }
    },
    [actions.createNote, items, expandFolder],
  );

  const createFolder = useCallback(
    async (parentFolderId: string | null) => {
      await actions.createFolder.mutateAsync({
        name: t("workspace.untitledFolder"),
        parentId: parentFolderId,
        sortOrder: nextSortOrder(items, parentFolderId),
      });
      if (parentFolderId) expandFolder(parentFolderId);
    },
    [actions.createFolder, items, expandFolder, t],
  );

  // ── Rename ─────────────────────────────────────────────────────
  const renameItem = useCallback(
    async (item: TreeItem, name: string) => {
      if (item.kind === "folder") {
        actions.renameFolder.mutate({ id: item.refId, name });
      } else if (item.kind === "note") {
        actions.renameNote.mutate({ id: item.refId, title: name });
      } else {
        await window.electronAPI.updateMeetingTitle(item.refId, name);
        queryClient.invalidateQueries({ queryKey: ["workspace-tree"] });
      }
    },
    [actions.renameFolder, actions.renameNote, queryClient],
  );

  // ── Delete ─────────────────────────────────────────────────────
  const deleteItem = useCallback(
    (item: TreeItem) => {
      if (item.kind === "folder") actions.deleteFolder.mutate(item.refId);
      else if (item.kind === "note") actions.deleteNote.mutate(item.refId);
      else actions.deleteMeeting.mutate(item.refId);
      if (selected?.refId === item.refId) setSelected(null);
    },
    [
      actions.deleteFolder,
      actions.deleteNote,
      actions.deleteMeeting,
      selected,
    ],
  );

  // ── Move / reorder ─────────────────────────────────────────────
  const moveItem = useCallback(
    (
      active: TreeItem,
      targetParentFolderId: string | null,
      after: TreeItem | null,
    ) => {
      // Guard: never move a folder into itself or a descendant.
      if (
        active.kind === "folder" &&
        targetParentFolderId &&
        isFolderDescendantOf(items, active.refId, targetParentFolderId)
      ) {
        return;
      }

      if (active.kind === "meeting") {
        actions.setMeetingFolder.mutate({
          id: active.refId,
          folderId: targetParentFolderId,
        });
        return;
      }

      // Nest / append (no precise position requested).
      if (!after) {
        const order = nextSortOrder(items, targetParentFolderId);
        if (active.kind === "folder") {
          actions.moveFolder.mutate({
            id: active.refId,
            parentId: targetParentFolderId,
            sortOrder: order,
          });
        } else {
          actions.moveNote.mutate({
            id: active.refId,
            folderId: targetParentFolderId,
            sortOrder: order,
          });
        }
        return;
      }

      // Reorder among orderable (folder/note) siblings, inserting after `after`.
      const siblings = orderableChildren(items, targetParentFolderId).filter(
        (s) => s.id !== active.id,
      );
      const idx = siblings.findIndex((s) => s.id === after.id);
      const insertAt = idx >= 0 ? idx + 1 : siblings.length;
      const newOrder = [...siblings];
      newOrder.splice(insertAt, 0, active);
      newOrder.forEach((node, i) => {
        const moved = node.id === active.id;
        const unchanged =
          !moved &&
          node.sortOrder === i &&
          node.parentFolderId === targetParentFolderId;
        if (unchanged) return;
        if (node.kind === "folder") {
          actions.moveFolder.mutate({
            id: node.refId,
            parentId: targetParentFolderId,
            sortOrder: i,
          });
        } else {
          actions.moveNote.mutate({
            id: node.refId,
            folderId: targetParentFolderId,
            sortOrder: i,
          });
        }
      });
    },
    [
      items,
      actions.setMeetingFolder,
      actions.moveFolder,
      actions.moveNote,
    ],
  );

  const handlers: WorkspaceHandlers = {
    selectItem,
    createNote,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
  };

  // ── Resizable sidebar ──────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const stored = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || "", 10);
    return Number.isFinite(stored) ? Math.min(MAX_W, Math.max(MIN_W, stored)) : 260;
  });
  const resizingRef = useRef(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!resizingRef.current) return;
      const w = Math.min(MAX_W, Math.max(MIN_W, e.clientX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [sidebarWidth]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div style={{ width: sidebarWidth }} className="shrink-0 h-full">
        <WorkspaceSidebar
          items={items}
          selectedId={selected?.id ?? null}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          handlers={handlers}
          onOpenSettings={onOpenSettings}
          onOpenUserContext={onOpenUserContext}
          onSelectAbility={selectAbility}
        />
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          resizingRef.current = true;
          document.body.style.cursor = "col-resize";
        }}
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 transition-colors"
      />

      {/* Content pane */}
      <div className="flex-1 min-w-0 h-full flex flex-col bg-background">
        {selected?.kind === "note" ? (
          <NoteEditor key={selected.refId} noteId={selected.refId} />
        ) : selected?.kind === "meeting" ? (
          <MeetingNoteView
            key={selected.refId}
            meetingId={selected.refId}
            onOpenSettings={onOpenSettings}
          />
        ) : selected?.kind === "mcp" ? (
          <McpEditor
            key={selected.refId}
            id={selected.refId}
            onDeleted={() => setSelected(null)}
          />
        ) : selected?.kind === "skill" ? (
          <SkillEditor
            key={selected.refId}
            id={selected.refId}
            onDeleted={() => setSelected(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <FileText size={40} className="text-text-tertiary mb-4" />
            <p className="text-text-secondary text-sm mb-1">
              {t("workspace.emptyStateTitle")}
            </p>
            <p className="text-text-tertiary text-xs max-w-xs">
              {t("workspace.emptyStateHint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Workspace;
