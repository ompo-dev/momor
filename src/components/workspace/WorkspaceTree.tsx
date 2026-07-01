import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import TreeRow from "./TreeRow";
import {
  flattenTree,
  type FlattenedItem,
  type TreeItem,
} from "./tree-utils";
import type { WorkspaceHandlers } from "./Workspace";

export const ROOT_DROP_ID = "__root__";

interface WorkspaceTreeProps {
  items: TreeItem[];
  selectedId: string | null;
  collapsed: Set<string>;
  onToggleCollapse: (compositeId: string) => void;
  handlers: WorkspaceHandlers;
}

interface DndRowProps {
  item: FlattenedItem;
  isActive: boolean;
  isDropTarget: boolean;
  selectedId: string | null;
  handlers: WorkspaceHandlers;
  onToggleCollapse: (compositeId: string) => void;
}

const DndRow: React.FC<DndRowProps> = ({
  item,
  isDropTarget,
  selectedId,
  handlers,
  onToggleCollapse,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
  } = useDraggable({ id: item.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: item.id });

  const setNodeRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <TreeRow
      item={item}
      isActive={selectedId === item.id}
      isDropTarget={isDropTarget}
      onSelect={() => handlers.selectItem(item)}
      onToggleCollapse={() => onToggleCollapse(item.id)}
      onRename={(name) => handlers.renameItem(item, name)}
      onDelete={() => handlers.deleteItem(item)}
      onCreateNote={
        item.kind === "folder"
          ? () => handlers.createNote(item.refId)
          : undefined
      }
      onCreateFolder={
        item.kind === "folder"
          ? () => handlers.createFolder(item.refId)
          : undefined
      }
      setNodeRef={setNodeRef}
      listeners={listeners}
      attributes={attributes}
    />
  );
};

const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  items,
  selectedId,
  collapsed,
  onToggleCollapse,
  handlers,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const flattened = useMemo(
    () => flattenTree(items, collapsed),
    [items, collapsed],
  );

  const { setNodeRef: setRootRef, isOver: isOverRoot } = useDroppable({
    id: ROOT_DROP_ID,
  });

  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const activeFlattened = flattened.find((i) => i.id === activeId) ?? null;

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    setOverId(e.over ? String(e.over.id) : null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const active = items.find((i) => i.id === String(e.active.id));
    setActiveId(null);
    setOverId(null);
    if (!active || !e.over) return;
    const overRawId = String(e.over.id);

    if (overRawId === ROOT_DROP_ID) {
      handlers.moveItem(active, null, null);
      return;
    }
    const over = items.find((i) => i.id === overRawId);
    if (!over || over.id === active.id) return;

    if (over.kind === "folder") {
      // Nest into this folder.
      handlers.moveItem(active, over.refId, null);
    } else {
      // Reorder as a sibling right after this leaf.
      handlers.moveItem(active, over.parentFolderId, over);
    }
  };

  // The drop target to highlight: the hovered row (or its folder).
  const highlightId =
    overId && overId !== ROOT_DROP_ID && overId !== activeId ? overId : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverId(null);
      }}
    >
      <div
        ref={setRootRef}
        className={
          isOverRoot && activeId ? "rounded-md ring-1 ring-primary/30" : ""
        }
      >
        {flattened.map((item) => (
          <DndRow
            key={item.id}
            item={item}
            isActive={selectedId === item.id}
            isDropTarget={highlightId === item.id}
            selectedId={selectedId}
            handlers={handlers}
            onToggleCollapse={onToggleCollapse}
          />
        ))}
        {flattened.length === 0 && (
          <div className="px-2 py-6 text-center text-[12px] text-text-tertiary">
            {/* empty state handled by sidebar */}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeFlattened ? (
          <TreeRow
            item={{ ...activeFlattened, depth: 0 }}
            isActive={false}
            overlay
            onSelect={() => {}}
            onToggleCollapse={() => {}}
            onRename={() => {}}
            onDelete={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default WorkspaceTree;
