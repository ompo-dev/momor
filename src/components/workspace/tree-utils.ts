// Tree model + helpers for the Notion-style workspace sidebar.
//
// The backend returns a flat { folders, notes, meetings } payload
// (see DatabaseManager.getWorkspaceTree). Here we turn it into a nested,
// display-ordered structure and a flattened list for rendering/DnD.

export type ItemKind = "folder" | "note" | "meeting";

export interface WorkspaceTreePayload {
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    icon: string | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }>;
  notes: Array<{
    id: string;
    folderId: string | null;
    title: string;
    icon: string | null;
    sortOrder: number;
    updatedAt: string;
  }>;
  meetings: Array<{
    id: string;
    folderId: string | null;
    title: string;
    date: string;
    sortOrder: number;
  }>;
}

export interface TreeItem {
  /** Composite id, unique across kinds: e.g. "folder:abc", "note:xyz". */
  id: string;
  kind: ItemKind;
  /** Raw DB id. */
  refId: string;
  /** DB id of the parent folder, or null for root. */
  parentFolderId: string | null;
  title: string;
  icon: string | null;
  sortOrder: number;
  /** Meetings only — ISO date for recency sorting / subtitle. */
  date?: string;
  /** Notes only — ISO updated_at. */
  updatedAt?: string;
}

export interface FlattenedItem extends TreeItem {
  depth: number;
  /** True when this is a folder that has at least one child. */
  hasChildren: boolean;
  collapsed: boolean;
}

const KIND_ORDER: Record<ItemKind, number> = {
  folder: 0,
  note: 1,
  meeting: 2,
};

export const compositeId = (kind: ItemKind, refId: string): string =>
  `${kind}:${refId}`;

export function parseCompositeId(id: string): {
  kind: ItemKind;
  refId: string;
} {
  const idx = id.indexOf(":");
  return {
    kind: id.slice(0, idx) as ItemKind,
    refId: id.slice(idx + 1),
  };
}

/** Flatten the backend payload into a single, unsorted list of TreeItems. */
export function toItems(payload: WorkspaceTreePayload): TreeItem[] {
  const items: TreeItem[] = [];
  for (const f of payload.folders) {
    items.push({
      id: compositeId("folder", f.id),
      kind: "folder",
      refId: f.id,
      parentFolderId: f.parentId,
      title: f.name,
      icon: f.icon,
      sortOrder: f.sortOrder,
      updatedAt: f.updatedAt,
    });
  }
  for (const n of payload.notes) {
    items.push({
      id: compositeId("note", n.id),
      kind: "note",
      refId: n.id,
      parentFolderId: n.folderId,
      title: n.title || "Untitled",
      icon: n.icon,
      sortOrder: n.sortOrder,
      updatedAt: n.updatedAt,
    });
  }
  for (const m of payload.meetings) {
    items.push({
      id: compositeId("meeting", m.id),
      kind: "meeting",
      refId: m.id,
      parentFolderId: m.folderId,
      title: m.title || "Untitled meeting",
      icon: null,
      sortOrder: m.sortOrder,
      date: m.date,
    });
  }
  return items;
}

function compareSiblings(a: TreeItem, b: TreeItem): number {
  // Meetings always cluster at the bottom of a group (date-sorted). They lack a
  // sort_order column, so keeping them out of the orderable run lets folders +
  // notes be reindexed cleanly without meetings floating around.
  const aMeet = a.kind === "meeting";
  const bMeet = b.kind === "meeting";
  if (aMeet !== bMeet) return aMeet ? 1 : -1;
  if (aMeet && bMeet) return (b.date ?? "").localeCompare(a.date ?? "");
  // Both are orderable (folder/note): sort by sortOrder, then kind, then title.
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return a.title.localeCompare(b.title);
}

/** True when `maybeAncestorRefId` is `folderRefId` itself or one of its ancestors. */
export function isFolderDescendantOf(
  items: TreeItem[],
  folderRefId: string,
  maybeDescendantRefId: string,
): boolean {
  let current: string | null = maybeDescendantRefId;
  const guard = new Set<string>();
  while (current) {
    if (current === folderRefId) return true;
    if (guard.has(current)) break;
    guard.add(current);
    const node = items.find(
      (i) => i.kind === "folder" && i.refId === current,
    );
    current = node ? node.parentFolderId : null;
  }
  return false;
}

/** Orderable (folder/note) children of a parent, in display order. */
export function orderableChildren(
  items: TreeItem[],
  parentFolderId: string | null,
): TreeItem[] {
  return items
    .filter(
      (i) => i.parentFolderId === parentFolderId && i.kind !== "meeting",
    )
    .sort(compareSiblings);
}

/** Children of a given folder id (null = root), display-ordered. */
export function childrenOf(
  items: TreeItem[],
  parentFolderId: string | null,
): TreeItem[] {
  return items
    .filter((i) => i.parentFolderId === parentFolderId)
    .sort(compareSiblings);
}

/**
 * Produce a depth-first flattened list honoring collapse state.
 * `collapsed` holds composite folder ids that should hide their children.
 */
export function flattenTree(
  items: TreeItem[],
  collapsed: Set<string>,
): FlattenedItem[] {
  const byParent = new Map<string | null, TreeItem[]>();
  for (const item of items) {
    const key = item.parentFolderId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(item);
  }
  for (const list of byParent.values()) list.sort(compareSiblings);

  const out: FlattenedItem[] = [];
  const walk = (parentFolderId: string | null, depth: number) => {
    const kids = byParent.get(parentFolderId) ?? [];
    for (const item of kids) {
      const hasChildren =
        item.kind === "folder" &&
        (byParent.get(item.refId)?.length ?? 0) > 0;
      const isCollapsed = collapsed.has(item.id);
      out.push({ ...item, depth, hasChildren, collapsed: isCollapsed });
      if (item.kind === "folder" && !isCollapsed) {
        walk(item.refId, depth + 1);
      }
    }
  };
  walk(null, 0);
  return out;
}

/** Next sort order to append an item as the last child of `parentFolderId`. */
export function nextSortOrder(
  items: TreeItem[],
  parentFolderId: string | null,
): number {
  const kids = childrenOf(items, parentFolderId);
  if (kids.length === 0) return 0;
  return Math.max(...kids.map((k) => k.sortOrder)) + 1;
}
