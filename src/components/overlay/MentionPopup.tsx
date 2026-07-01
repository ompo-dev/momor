import React from "react";
import { Sparkles, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MentionItem {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
}

interface MentionPopupProps {
  trigger: "/" | "@";
  items: MentionItem[];
  activeIndex: number;
  onSelect: (item: MentionItem) => void;
  onHover: (index: number) => void;
  emptyLabel: string;
}

/** Autocomplete dropdown for "/" (skills) and "@" (mcps), anchored above the input. */
const MentionPopup: React.FC<MentionPopupProps> = ({
  trigger,
  items,
  activeIndex,
  onSelect,
  onHover,
  emptyLabel,
}) => {
  const Icon = trigger === "/" ? Sparkles : Plug;
  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1.5 z-50 max-h-56 overflow-y-auto custom-scrollbar rounded-xl border overlay-input-surface backdrop-blur-xl py-1 shadow-xl"
      data-stealth-ignore="true"
      onMouseDown={(e) => e.preventDefault() /* keep input focus */}
    >
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider overlay-text-muted">
        {trigger === "/" ? "Skills" : "MCPs"}
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-2 text-[12px] overlay-text-muted">{emptyLabel}</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(item)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-left",
              i === activeIndex
                ? "overlay-icon-surface-hover"
                : "hover:overlay-icon-surface-hover",
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0 overlay-text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] overlay-input-text">
                {item.name}
              </span>
              {item.description && (
                <span className="block truncate text-[11px] overlay-text-muted">
                  {item.description}
                </span>
              )}
            </span>
            {item.enabled === false && (
              <span className="shrink-0 text-[10px] overlay-text-muted">off</span>
            )}
          </button>
        ))
      )}
    </div>
  );
};

export default MentionPopup;
