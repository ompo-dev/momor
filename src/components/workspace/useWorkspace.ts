// React-Query hooks for the workspace tree + folder/note mutations.
import { useCallback, useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import {
  toItems,
  type TreeItem,
  type WorkspaceTreePayload,
} from "./tree-utils";

const TREE_KEY = ["workspace-tree"] as const;

const EMPTY_TREE: WorkspaceTreePayload = {
  folders: [],
  notes: [],
  meetings: [],
};

export function useWorkspaceTree() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: TREE_KEY,
    queryFn: async (): Promise<WorkspaceTreePayload> => {
      const tree = await window.electronAPI?.workspaceGetTree?.();
      return tree ?? EMPTY_TREE;
    },
    staleTime: 5_000,
  });

  // Refresh the tree whenever meetings change (e.g. a call finishes processing).
  useEffect(() => {
    const unsub = window.electronAPI?.onMeetingsUpdated?.(() => {
      queryClient.invalidateQueries({ queryKey: TREE_KEY });
    });
    return () => unsub?.();
  }, [queryClient]);

  const payload = query.data ?? EMPTY_TREE;
  const items: TreeItem[] = toItems(payload);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: TREE_KEY }),
    [queryClient],
  );

  return { ...query, payload, items, invalidate };
}

/** Bundle of mutating actions; each invalidates the tree on settle. */
export function useWorkspaceActions() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: TREE_KEY });

  const onError = (label: string) => (err: unknown) =>
    console.error(`[workspace] ${label} failed:`, err);

  const createFolder = useMutation({
    mutationFn: (input: { name: string; parentId?: string | null; sortOrder?: number }) => {
      if (!window.electronAPI?.folderCreate) {
        return Promise.reject(
          new Error(
            "folderCreate IPC not available — the app's main process is running stale code. Fully quit and relaunch the app.",
          ),
        );
      }
      return window.electronAPI.folderCreate(input);
    },
    onError: onError("createFolder"),
    onSettled: invalidate,
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      window.electronAPI.folderRename(id, name),
    onSettled: invalidate,
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => window.electronAPI.folderDelete(id),
    onSettled: invalidate,
  });

  const moveFolder = useMutation({
    mutationFn: ({
      id,
      parentId,
      sortOrder,
    }: {
      id: string;
      parentId: string | null;
      sortOrder: number;
    }) => window.electronAPI.folderMove(id, parentId, sortOrder),
    onSettled: invalidate,
  });

  const createNote = useMutation({
    mutationFn: (input: {
      title?: string;
      folderId?: string | null;
      sortOrder?: number;
    }) => {
      if (!window.electronAPI?.noteCreate) {
        return Promise.reject(
          new Error(
            "noteCreate IPC not available — the app's main process is running stale code. Fully quit and relaunch the app.",
          ),
        );
      }
      return window.electronAPI.noteCreate(input);
    },
    onError: onError("createNote"),
    onSettled: invalidate,
  });

  const renameNote = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      window.electronAPI.noteUpdate(id, { title }),
    onSettled: invalidate,
  });

  const deleteNote = useMutation({
    mutationFn: (id: string) => window.electronAPI.noteDelete(id),
    onSettled: invalidate,
  });

  const moveNote = useMutation({
    mutationFn: ({
      id,
      folderId,
      sortOrder,
    }: {
      id: string;
      folderId: string | null;
      sortOrder: number;
    }) => window.electronAPI.noteMove(id, folderId, sortOrder),
    onSettled: invalidate,
  });

  const setMeetingFolder = useMutation({
    mutationFn: ({
      id,
      folderId,
    }: {
      id: string;
      folderId: string | null;
    }) => window.electronAPI.meetingSetFolder(id, folderId),
    onSettled: invalidate,
  });

  const deleteMeeting = useMutation({
    mutationFn: (id: string) => window.electronAPI.deleteMeeting(id),
    onSettled: invalidate,
  });

  return {
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    createNote,
    renameNote,
    deleteNote,
    moveNote,
    setMeetingFolder,
    deleteMeeting,
  };
}
