import React, { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { ZedListItem } from "../zed/ZedListItem";
import { ZedIconButton } from "../zed/ZedIconButton";

interface AbilityItem {
  id: string;
  name: string;
  enabled: boolean;
  source: "openclaude" | "momor";
}

interface AbilitySectionProps {
  title: string;
  icon: React.ReactNode;
  items: AbilityItem[];
  /** Composite id of the selected item ("mcp:x" / "skill:x"), if any. */
  selectedId: string | null;
  compositePrefix: "mcp" | "skill";
  emptyLabel: string;
  onSelect: (refId: string) => void;
  onAdd: () => void;
}

/**
 * Collapsible sidebar section listing MCP servers or Skills, with add + select.
 * Backend provenance stays hidden here so abilities read as first-party items.
 */
const AbilitySection: React.FC<AbilitySectionProps> = ({
  title,
  icon,
  items,
  selectedId,
  compositePrefix,
  emptyLabel,
  onSelect,
  onAdd,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-1.5">
      <div className="group/section flex min-w-0 items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-text-tertiary hover:text-text-secondary"
        >
          <ChevronRight
            size={12}
            className={cn("transition-transform", open && "rotate-90")}
          />
          <span className="flex shrink-0 items-center text-text-secondary [&_svg]:size-3.5">
            {icon}
          </span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em]">
            {title}
          </span>
          {items.length > 0 ? (
            <span className="rounded-sm border border-border-subtle bg-secondary/45 px-1 text-[9px] font-medium leading-4 text-text-tertiary">
              {items.length}
            </span>
          ) : null}
        </button>
        <ZedIconButton
          icon={<Plus size={13} />}
          size="sm"
          styleVariant="subtle"
          onClick={onAdd}
          aria-label={`+ ${title}`}
          title={`+ ${title}`}
          className="opacity-70 transition-opacity hover:opacity-100 group-hover/section:opacity-100"
        />
      </div>

      {open && (
        <div className="space-y-1 border-l border-border-subtle/70 pl-2">
          {items.length === 0 ? (
            <ZedListItem
              onClick={onAdd}
              spacing="extraDense"
              className="ml-0.5 min-h-6 pl-2 pr-1 text-[11.5px] text-text-secondary"
              startSlot={<Plus size={13} />}
            >
              {emptyLabel}
            </ZedListItem>
          ) : (
            items.map((item) => {
              const active = selectedId === `${compositePrefix}:${item.id}`;
              return (
                <ZedListItem
                  key={item.id}
                  title={item.name || t("workspace.untitled")}
                  onClick={() => onSelect(item.id)}
                  selected={active}
                  spacing="extraDense"
                  className={cn(
                    "ml-0.5 min-h-[30px] pl-2 pr-1.5",
                    !item.enabled && "opacity-75",
                  )}
                  startSlot={
                    <span
                      className={cn(
                        "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        item.enabled
                          ? "bg-emerald-500"
                          : "bg-text-tertiary/40",
                      )}
                      title={
                        item.enabled
                          ? t("workspace.enabled")
                          : t("workspace.disabled")
                      }
                    />
                  }
                  endSlot={
                    item.enabled === false ? (
                      <span className="shrink-0 rounded-sm border border-border-subtle/80 bg-background/45 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
                        off
                      </span>
                    ) : null
                  }
                >
                  <span
                    title={item.name || t("workspace.untitled")}
                    className={cn(
                      "block whitespace-normal break-words pr-1 text-[11.5px] leading-[1.35]",
                      active ? "text-text-primary" : "text-text-secondary",
                    )}
                  >
                    {item.name || t("workspace.untitled")}
                  </span>
                </ZedListItem>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default AbilitySection;
