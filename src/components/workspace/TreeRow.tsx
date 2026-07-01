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

const INDENT_PX = 14;

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

const KindIcon: React.FC<{ item: FlattenedItem }> = ({ item }) => {
  if (item.kind === "folder") {
    return item.collapsed ? (
      <FolderIcon size={15} className="text-text-secondary shrink-0" />
    ) : (
      <FolderOpen size={15} className="text-text-secondary shrink-0" />
    );
  }
  if (item.kind === "meeting") {
    return <Mic size={15} className="text-text-secondary shrink-0" />;
  }
  return <FileText size={15} className="text-text-secondary shrink-0" />;
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

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, paddingLeft: 8 + item.depth * INDENT_PX }}
      {...attributes}
      className={cn(
        "group relative flex items-center gap-1 pr-1.5 h-7 rounded-md cursor-pointer select-none",
        "hover:bg-accent/60 transition-colors",
        isActive && "bg-accent",
        isDropTarget && "ring-1 ring-primary/60 bg-primary/5",
        overlay && "bg-card shadow-lg ring-1 ring-border w-[220px]",
      )}
      onClick={() => {
        if (!isRenaming) onSelect();
      }}
    >
      {/* Chevron / spacer */}
      {isFolder ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-secondary"
        >
          <ChevronRight
            size={14}
            className={cn(
              "transition-transform",
              !item.collapsed && "rotate-90",
            )}
          />
        </button>
      ) : (
        <span className="w-[19px] shrink-0" />
      )}

      {/* Drag handle area = icon + title */}
      <span className="flex items-center gap-1.5 flex-1 min-w-0" {...listeners}>
        {item.icon ? (
          isImageIcon(item.icon) ? (
            <img
              src={item.icon}
              alt=""
              className="h-[15px] w-[15px] shrink-0 rounded-sm object-cover"
            />
          ) : (
            <span className="text-[15px] leading-none shrink-0">{item.icon}</span>
          )
        ) : (
          <KindIcon item={item} />
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
            className="flex-1 min-w-0 bg-background border border-border rounded px-1 py-0.5 text-[13px] text-text-primary outline-none"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-[13px] text-text-primary">
            {item.title}
          </span>
        )}
      </span>

      {/* Hover actions */}
      {!overlay && !isRenaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isFolder && onCreateNote && (
            <button
              type="button"
              title={t("workspace.newPageInside")}
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote();
              }}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-secondary"
            >
              <Plus size={14} />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-secondary"
              >
                <MoreHorizontal size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
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
