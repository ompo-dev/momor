import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MentionItem {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
}

interface MentionPopupProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  trigger: "/" | "@";
  items: MentionItem[];
  activeIndex: number;
  onSelect: (item: MentionItem) => void;
  onHover: (index: number) => void;
  emptyLabel: string;
}

type PopupGeometry = {
  bottom: number;
  left: number;
  maxHeight: number;
  width: number;
};

/** Autocomplete dropdown for "/" (skills) and "@" (mcps), anchored above the input. */
const MentionPopup: React.FC<MentionPopupProps> = ({
  anchorRef,
  trigger,
  items,
  activeIndex,
  onSelect,
  onHover,
  emptyLabel,
}) => {
  const Icon = trigger === "/" ? Sparkles : Plug;
  const [geometry, setGeometry] = useState<PopupGeometry | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const updateGeometry = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) {
        setGeometry(null);
        return;
      }

      const viewportPadding = 12;
      const gap = 8;
      const maxWidth = Math.min(560, window.innerWidth - viewportPadding * 2);
      const width = Math.min(
        maxWidth,
        Math.max(Math.ceil(rect.width), Math.min(360, maxWidth)),
      );
      const left = Math.min(
        window.innerWidth - viewportPadding - width,
        Math.max(viewportPadding, Math.round(rect.left)),
      );
      const maxHeight = Math.max(
        140,
        Math.min(320, Math.floor(rect.top - viewportPadding - gap)),
      );
      const bottom = Math.max(
        viewportPadding,
        Math.round(window.innerHeight - rect.top + gap),
      );

      setGeometry({ bottom, left, maxHeight, width });
    };

    updateGeometry();
    window.addEventListener("resize", updateGeometry);
    window.addEventListener("scroll", updateGeometry, true);
    return () => {
      window.removeEventListener("resize", updateGeometry);
      window.removeEventListener("scroll", updateGeometry, true);
    };
  }, [activeIndex, anchorRef, items.length, trigger]);

  if (typeof document === "undefined" || !geometry) return null;

  return createPortal(
    <div
      className="custom-scrollbar fixed z-[2147483647] overflow-y-auto rounded-xl border overlay-input-surface py-1 shadow-2xl backdrop-blur-xl"
      data-stealth-ignore="true"
      onMouseDown={(e) => e.preventDefault() /* keep input focus */}
      style={{
        bottom: geometry.bottom,
        left: geometry.left,
        maxHeight: geometry.maxHeight,
        width: geometry.width,
      }}
    >
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider overlay-text-muted">
        {trigger === "/" ? "Skills" : "MCPs"}
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-2 text-[12px] overlay-text-muted">
          {emptyLabel}
        </div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(item)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left",
              i === activeIndex
                ? "overlay-icon-surface-hover"
                : "hover:overlay-icon-surface-hover",
            )}
            title={item.name}
          >
            <Icon className="w-3.5 h-3.5 shrink-0 overlay-text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[13px] leading-snug overlay-input-text">
                {item.name}
              </span>
            </span>
            {item.enabled === false && (
              <span className="shrink-0 text-[10px] overlay-text-muted">off</span>
            )}
          </button>
        ))
      )}
    </div>,
    document.body,
  );
};

export default MentionPopup;
