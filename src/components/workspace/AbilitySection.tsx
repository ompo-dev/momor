import React, { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

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

/** Collapsible sidebar section listing MCP servers or Skills, with add + select. */
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
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-1">
      <div className="group/section flex items-center gap-1 px-1.5 h-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 flex-1 min-w-0 text-text-tertiary hover:text-text-secondary"
        >
          <ChevronRight
            size={12}
            className={cn("transition-transform", open && "rotate-90")}
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
            {title}
          </span>
        </button>
        <button
          type="button"
          title={`+ ${title}`}
          onClick={onAdd}
          className="p-0.5 rounded opacity-0 group-hover/section:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 text-text-secondary transition-opacity"
        >
          <Plus size={13} />
        </button>
      </div>

      {open && (
        <div className="mt-0.5">
          {items.length === 0 ? (
            <button
              type="button"
              onClick={onAdd}
              className="w-full flex items-center gap-1.5 pl-6 pr-2 h-7 text-left text-[12px] text-text-tertiary hover:bg-accent/40 rounded-md"
            >
              <Plus size={13} />
              {emptyLabel}
            </button>
          ) : (
            items.map((item) => {
              const active = selectedId === `${compositePrefix}:${item.id}`;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2 pl-6 pr-2 h-7 rounded-md text-left hover:bg-accent/60",
                    active && "bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      item.enabled ? "bg-emerald-500" : "bg-text-tertiary/40",
                    )}
                    title={item.enabled ? "Ativo" : "Desativado"}
                  />
                  <span className="shrink-0 text-text-secondary">{icon}</span>
                  <span className="flex-1 min-w-0 truncate text-[13px] text-text-primary">
                    {item.name || "Untitled"}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                      item.source === "openclaude"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    )}
                    title={
                      item.source === "openclaude"
                        ? "Synced and ready"
                        : "Legacy Momor draft"
                    }
                  >
                    {item.source === "openclaude" ? "Synced" : "Draft"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default AbilitySection;
