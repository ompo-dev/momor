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
import { ZedListItem } from "../zed/ZedListItem";
import { ZedIconButton } from "../zed/ZedIconButton";

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

  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  const filteredDocuments = useMemo(() => {
    if (!normalizedQuery) return [];
    return items
      .filter((item) => item.title.toLowerCase().includes(normalizedQuery))
      .slice(0, 50);
  }, [items, normalizedQuery]);

  const filteredMcps = useMemo(() => {
    if (!normalizedQuery) return [];
    return mcps
      .filter((item) => item.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 20);
  }, [mcps, normalizedQuery]);

  const filteredSkills = useMemo(() => {
    if (!normalizedQuery) return [];
    return skills
      .filter((item) => item.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 20);
  }, [skills, normalizedQuery]);

  const hasFilteredResults =
    filteredDocuments.length > 0 ||
    filteredMcps.length > 0 ||
    filteredSkills.length > 0;

  const documentCount = useMemo(
    () =>
      items.filter((item) => item.kind === "note" || item.kind === "meeting")
        .length,
    [items],
  );

  return (
    <div className="flex h-full flex-col border-r border-border-subtle/85 bg-bg-sidebar text-text-primary">
      <div className="border-b border-border-subtle/80 px-1.5 py-1.5">
        <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            {t("workspace.title")}
          </span>
          <div className="flex items-center gap-0.5">
            <ZedIconButton
              icon={<FolderPlus />}
              size="sm"
              styleVariant="subtle"
              onClick={() => handlers.createFolder(null)}
              aria-label={t("workspace.newFolder")}
              title={t("workspace.newFolder")}
            />
            <ZedIconButton
              icon={<FilePlus />}
              size="sm"
              styleVariant="subtle"
              onClick={() => handlers.createNote(null)}
              aria-label={t("workspace.newPage")}
              title={t("workspace.newPage")}
            />
          </div>
        </div>

        <div className="flex h-7 items-center gap-1.5 rounded-sm border border-border-subtle/75 bg-background/35 px-2 transition-colors focus-within:border-border-muted focus-within:bg-background/55">
          <Search size={13} className="shrink-0 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("workspace.searchPlaceholderCompact")}
            className="min-w-0 flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-1.5 py-1.5">
        {hasQuery ? (
          hasFilteredResults ? (
            <div className="space-y-3">
              {filteredDocuments.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                      {t("workspace.documentsSection")}
                    </span>
                    <div className="h-px flex-1 bg-border-subtle/80" />
                  </div>

                  <div className="space-y-px">
                    {filteredDocuments.map((item) => (
                      <ZedListItem
                        key={item.id}
                        title={item.title}
                        onClick={() => handlers.selectItem(item)}
                        selected={selectedId === item.id}
                        spacing="extraDense"
                        startSlot={
                          item.kind === "folder" ? (
                            <FolderIcon size={14} />
                          ) : item.kind === "meeting" ? (
                            <Mic size={14} />
                          ) : (
                            <FileText size={14} />
                          )
                        }
                      >
                        <span
                          className={cn(
                            "truncate text-[11.5px]",
                            selectedId === item.id
                              ? "text-text-primary"
                              : "text-text-secondary",
                          )}
                        >
                          {item.title}
                        </span>
                      </ZedListItem>
                    ))}
                  </div>
                </div>
              ) : null}

              {filteredMcps.length > 0 || filteredSkills.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                      {t("workspace.toolsSection")}
                    </span>
                    <div className="h-px flex-1 bg-border-subtle/80" />
                  </div>

                  {filteredMcps.length > 0 ? (
                    <div className="space-y-px">
                      {filteredMcps.map((item) => {
                        const active = selectedId === `mcp:${item.id}`;
                        return (
                          <ZedListItem
                            key={`mcp:${item.id}`}
                            title={item.name}
                            onClick={() => onSelectAbility("mcp", item.id)}
                            selected={active}
                            spacing="extraDense"
                            startSlot={<Plug size={14} />}
                          >
                            <span
                              className={cn(
                                "truncate text-[11.5px]",
                                active
                                  ? "text-text-primary"
                                  : "text-text-secondary",
                              )}
                            >
                              {item.name}
                            </span>
                          </ZedListItem>
                        );
                      })}
                    </div>
                  ) : null}

                  {filteredSkills.length > 0 ? (
                    <div className="space-y-px">
                      {filteredSkills.map((item) => {
                        const active = selectedId === `skill:${item.id}`;
                        return (
                          <ZedListItem
                            key={`skill:${item.id}`}
                            title={item.name}
                            onClick={() => onSelectAbility("skill", item.id)}
                            selected={active}
                            spacing="extraDense"
                            startSlot={<Sparkles size={14} />}
                          >
                            <span
                              className={cn(
                                "truncate text-[11.5px]",
                                active
                                  ? "text-text-primary"
                                  : "text-text-secondary",
                              )}
                            >
                              {item.name}
                            </span>
                          </ZedListItem>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="px-2 py-6 text-center text-[11.5px] text-text-tertiary">
              {t("workspace.noResults")}
            </div>
          )
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {t("workspace.documentsSection")}
                </span>
                <div className="h-px flex-1 bg-border-subtle/80" />
                <span className="rounded-sm border border-border-subtle/80 bg-background/45 px-1 text-[9px] font-medium leading-4 text-text-tertiary">
                  {documentCount}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="px-2 py-3">
                  <p className="mb-3 text-[11px] leading-5 text-text-tertiary">
                    {t("workspace.emptyHintCompact")}
                  </p>
                  <ZedListItem
                    onClick={() => handlers.createNote(null)}
                    spacing="dense"
                    className="w-full justify-center border-border-muted bg-bg-item-active text-text-primary hover:bg-bg-item-active/90 hover:text-text-primary"
                    startSlot={<FilePlus size={14} />}
                  >
                    {t("workspace.newPage")}
                  </ZedListItem>
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
            </div>

            <div className="mt-3 space-y-2 border-t border-border-subtle/80 pt-2">
              <div className="flex items-center gap-2 px-1">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {t("workspace.toolsSection")}
                </span>
                <div className="h-px flex-1 bg-border-subtle/80" />
              </div>

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
            </div>
          </>
        )}
      </div>

      <WorkspaceUserFooter
        onOpenSettings={onOpenSettings}
        onOpenUserContext={onOpenUserContext}
      />
    </div>
  );
};

export default WorkspaceSidebar;
