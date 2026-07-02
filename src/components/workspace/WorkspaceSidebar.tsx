import React, { useEffect, useMemo, useState } from "react";
import {
  FilePlus,
  FolderPlus,
  Search,
  FileText,
  Folder as FolderIcon,
  Mic,
  Plug,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import WorkspaceTree from "./WorkspaceTree";
import WorkspaceUserFooter from "./WorkspaceUserFooter";
import AbilitySection from "./AbilitySection";
import { useMcpServers, useSkills, useAbilityActions } from "./useAbilities";
import type { TreeItem } from "./tree-utils";
import type { WorkspaceHandlers } from "./Workspace";

interface WorkspaceSidebarProps {
  items: TreeItem[];
  selectedId: string | null;
  collapsed: Set<string>;
  onToggleCollapse: (compositeId: string) => void;
  handlers: WorkspaceHandlers;
  onOpenSettings: (tab?: string) => void;
  onOpenUserContext: () => void;
  onSelectAbility: (kind: "mcp" | "skill", refId: string) => void;
}

const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  items,
  selectedId,
  collapsed,
  onToggleCollapse,
  handlers,
  onOpenSettings,
  onOpenUserContext,
  onSelectAbility,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { data: mcps = [] } = useMcpServers();
  const { data: skills = [] } = useSkills();
  const { invalidateMcps, invalidateSkills } = useAbilityActions();

  // Refresh when the agent installs a skill/MCP from chat.
  useEffect(() => {
    const unsub = window.electronAPI?.onAbilitiesUpdated?.(() => {
      invalidateMcps();
      invalidateSkills();
    });
    return () => unsub?.();
  }, [invalidateMcps, invalidateSkills]);

  const addMcp = async () => {
    const res = await window.electronAPI.mcpCreate({
      name: "new-server",
      transport: "stdio",
    });
    invalidateMcps();
    if (res?.id) onSelectAbility("mcp", res.id);
  };

  const addSkill = async () => {
    const res = await window.electronAPI.skillCreate({
      name: t("workspace.newSkill"),
    });
    invalidateSkills();
    if (res?.id) onSelectAbility("skill", res.id);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return items
      .filter((i) => i.title.toLowerCase().includes(q))
      .slice(0, 50);
  }, [items, query]);

  return (
    <div className="flex flex-col h-full bg-bg-elevated/60 border-r border-border-subtle">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-text-tertiary">
          {t("workspace.title")}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title={t("workspace.newFolder")}
            onClick={() => handlers.createFolder(null)}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-secondary"
          >
            <FolderPlus size={15} />
          </button>
          <button
            type="button"
            title={t("workspace.newPage")}
            onClick={() => handlers.createNote(null)}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-secondary"
          >
            <FilePlus size={15} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-2 h-7 rounded-md bg-muted/50 border border-border-subtle">
          <Search size={13} className="text-text-tertiary shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("workspace.searchPlaceholder")}
            className="flex-1 min-w-0 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 pb-4">
        {filtered ? (
          filtered.length > 0 ? (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handlers.selectItem(item)}
                className={cn(
                  "w-full flex items-center gap-1.5 px-2 h-7 rounded-md text-left hover:bg-accent/60",
                  selectedId === item.id && "bg-accent",
                )}
              >
                {item.kind === "folder" ? (
                  <FolderIcon size={14} className="text-text-secondary shrink-0" />
                ) : item.kind === "meeting" ? (
                  <Mic size={14} className="text-text-secondary shrink-0" />
                ) : (
                  <FileText size={14} className="text-text-secondary shrink-0" />
                )}
                <span className="flex-1 min-w-0 truncate text-[13px] text-text-primary">
                  {item.title}
                </span>
              </button>
            ))
          ) : (
            <div className="px-2 py-6 text-center text-[12px] text-text-tertiary">
              {t("workspace.noResults")}
            </div>
          )
        ) : (
          <>
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-[12px] text-text-tertiary mb-3">
                  {t("workspace.emptyHint")}
                </p>
                <button
                  type="button"
                  onClick={() => handlers.createNote(null)}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/15"
                >
                  <FilePlus size={14} />
                  {t("workspace.newPage")}
                </button>
              </div>
            ) : (
              <WorkspaceTree
                items={items}
                selectedId={selectedId}
                collapsed={collapsed}
                onToggleCollapse={onToggleCollapse}
                handlers={handlers}
              />
            )}

            {/* Configurable abilities, surfaced as folder-like sections */}
            <AbilitySection
              title={t("workspace.mcps")}
              icon={<Plug size={14} />}
              items={mcps.map((m) => ({
                id: m.id,
                name: m.name,
                enabled: m.enabled,
                source: m.source,
              }))}
              selectedId={selectedId}
              compositePrefix="mcp"
              emptyLabel={t("workspace.addMcp")}
              onSelect={(refId) => onSelectAbility("mcp", refId)}
              onAdd={addMcp}
            />
            <AbilitySection
              title={t("workspace.skills")}
              icon={<Sparkles size={14} />}
              items={skills.map((s) => ({
                id: s.id,
                name: s.name,
                enabled: s.enabled,
                source: s.source,
              }))}
              selectedId={selectedId}
              compositePrefix="skill"
              emptyLabel={t("workspace.addSkill")}
              onSelect={(refId) => onSelectAbility("skill", refId)}
              onAdd={addSkill}
            />
          </>
        )}
      </div>

      {/* Footer: AI profile switcher + user context + settings (was in the top header) */}
      <WorkspaceUserFooter
        onOpenSettings={onOpenSettings}
        onOpenUserContext={onOpenUserContext}
      />
    </div>
  );
};

export default WorkspaceSidebar;
