import React, { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  Mic,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { FlattenedItem } from "./tree-utils";
import { isImageIcon } from "./iconUtils";

const INDENT_PX = 12;

export interface TreeRowProps {
  item: FlattenedItem;
  isActive: boolean;
  isDropTarget?: boolean;
  overlay?: boolean;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onCreateNote?: () => void;
  onCreateFolder?: () => void;
  // dnd-kit wiring (optional so the row can render standalone in a DragOverlay)
  setNodeRef?: (el: HTMLElement | null) => void;
  listeners?: Record<string, any>;
  attributes?: Record<string, any>;
  style?: React.CSSProperties;
}

const KindIcon: React.FC<{ item: FlattenedItem; active: boolean }> = ({
  item,
  active,
}) => {
  const tone = active ? "text-text-primary" : "text-text-secondary";
  if (item.kind === "folder") {
    return item.collapsed ? (
      <FolderIcon size={14} className={cn("shrink-0", tone)} />
    ) : (
      <FolderOpen size={14} className={cn("shrink-0", tone)} />
    );
  }
  if (item.kind === "meeting") {
    return <Mic size={14} className={cn("shrink-0", tone)} />;
  }
  return <FileText size={14} className={cn("shrink-0", tone)} />;
};

const TreeRow: React.FC<TreeRowProps> = ({
  item,
  isActive,
  isDropTarget,
  overlay,
  onSelect,
  onToggleCollapse,
  onRename,
  onDelete,
  onCreateNote,
  onCreateFolder,
  setNodeRef,
  listeners,
  attributes,
  style,
}) => {
  const { t } = useTranslation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.title) onRename(trimmed);
    else setDraft(item.title);
    setIsRenaming(false);
  };

  const isFolder = item.kind === "folder";
  const showDisclosure = isFolder && item.hasChildren;
  const indentWidth = item.depth * INDENT_PX;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      data-active={isActive ? "true" : undefined}
      className={cn(
        "group relative flex h-6 cursor-pointer select-none items-center rounded-sm px-0.5 text-[11.5px] transition-colors",
        !isActive && "text-text-secondary hover:bg-accent/60 hover:text-text-primary",
        isActive && "bg-bg-item-active text-text-primary ring-1 ring-border-subtle/70",
        isDropTarget && "bg-primary/5 ring-1 ring-primary/55",
        overlay && "w-[220px] bg-bg-elevated shadow-lg ring-1 ring-border-subtle/80",
      )}
      onClick={() => {
        if (!isRenaming) onSelect();
      }}
    >
      <div className="flex min-w-0 flex-1 items-center">
        {indentWidth > 0 ? (
          <span
            className="relative shrink-0"
            style={{ width: indentWidth }}
            aria-hidden="true"
          >
            <span className="absolute bottom-1 top-1 right-2 w-px rounded-full bg-border-subtle/75" />
          </span>
        ) : (
          <span className="w-0.5 shrink-0" aria-hidden="true" />
        )}

        {showDisclosure ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className={cn(
              "mr-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm transition-colors",
              isActive
                ? "text-text-primary hover:bg-black/10 dark:hover:bg-white/10"
                : "text-text-tertiary hover:bg-black/10 hover:text-text-secondary dark:hover:bg-white/10",
            )}
          >
            <ChevronRight
              size={13}
              className={cn("transition-transform", !item.collapsed && "rotate-90")}
            />
          </button>
        ) : (
          <span className="mr-0.5 w-[18px] shrink-0" />
        )}

        <span className="flex min-w-0 flex-1 items-center gap-1.5" {...listeners}>
          {item.icon ? (
            isImageIcon(item.icon) ? (
              <img
                src={item.icon}
                alt=""
                className="h-[13px] w-[13px] shrink-0 rounded-sm object-cover"
              />
            ) : (
              <span className="shrink-0 text-[14px] leading-none">{item.icon}</span>
            )
          ) : (
            <KindIcon item={item} active={isActive} />
          )}
          {isRenaming ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraft(item.title);
                  setIsRenaming(false);
                }
              }}
              className="min-w-0 flex-1 rounded-sm border border-border-muted bg-background px-1 py-0 text-[11.5px] text-text-primary outline-none"
            />
          ) : (
            <span
              className={cn(
                "block min-w-0 flex-1 truncate",
                isActive ? "text-text-primary" : "text-text-secondary",
              )}
            >
              {item.title}
            </span>
          )}
        </span>
      </div>

      {/* Hover actions */}
      {!overlay && !isRenaming && (
        <div
          className={cn(
            "flex items-center gap-0.5 transition-opacity",
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {isFolder && onCreateNote && (
            <button
              type="button"
              title={t("workspace.newPageInside")}
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote();
              }}
              className="rounded-sm p-[2px] text-text-secondary hover:bg-black/10 hover:text-text-primary dark:hover:bg-white/10"
            >
              <Plus size={13} />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="rounded-sm p-[2px] text-text-secondary hover:bg-black/10 hover:text-text-primary dark:hover:bg-white/10"
              >
                <MoreHorizontal size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(item.title);
                  setIsRenaming(true);
                }}
              >
                <Pencil size={13} className="mr-2" />
                {t("workspace.rename")}
              </DropdownMenuItem>
              {isFolder && onCreateNote && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNote();
                  }}
                >
                  <FileText size={13} className="mr-2" />
                  {t("workspace.newPageInside")}
                </DropdownMenuItem>
              )}
              {isFolder && onCreateFolder && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder();
                  }}
                >
                  <FolderPlus size={13} className="mr-2" />
                  {t("workspace.newSubfolder")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 size={13} className="mr-2" />
                {t("workspace.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};

export default TreeRow;
