import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Sparkles, Plug } from "lucide-react";
import { ZedListItem } from "../zed/ZedListItem";

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
  left: number;
  maxHeight: number;
  offset: number;
  placement: "above" | "below";
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
  const { t } = useTranslation();
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
      const maxWidth = Math.min(620, window.innerWidth - viewportPadding * 2);
      const preferredWidth = Math.min(
        maxWidth,
        Math.max(Math.ceil(rect.width) + 32, Math.min(420, maxWidth)),
      );
      const width = Math.min(
        maxWidth,
        Math.max(preferredWidth, Math.min(420, maxWidth)),
      );
      const left = Math.min(
        window.innerWidth - viewportPadding - width,
        Math.max(viewportPadding, Math.round(rect.left)),
      );
      const spaceAbove = Math.max(
        0,
        Math.floor(rect.top - viewportPadding - gap),
      );
      const spaceBelow = Math.max(
        0,
        Math.floor(window.innerHeight - rect.bottom - viewportPadding - gap),
      );
      const placement =
        spaceAbove >= 220 || spaceAbove >= spaceBelow ? "above" : "below";
      const availableSpace = placement === "above" ? spaceAbove : spaceBelow;
      const offset =
        placement === "above"
          ? Math.max(
              viewportPadding,
              Math.round(window.innerHeight - rect.top + gap),
            )
          : Math.max(viewportPadding, Math.round(rect.bottom + gap));
      const maxHeight = Math.max(120, Math.min(400, availableSpace));

      setGeometry({ left, maxHeight, offset, placement, width });
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
      className="custom-scrollbar fixed z-[2147483647] overflow-hidden rounded-[10px] border border-border-subtle/80 bg-card/99 shadow-[0_24px_56px_-34px_rgba(0,0,0,0.88)] backdrop-blur-xl"
      data-stealth-ignore="true"
      onMouseDown={(e) => e.preventDefault() /* keep input focus */}
      style={{
        left: geometry.left,
        maxHeight: geometry.maxHeight,
        ...(geometry.placement === "above"
          ? { bottom: geometry.offset }
          : { top: geometry.offset }),
        width: geometry.width,
      }}
    >
      <div className="flex items-center justify-between border-b border-border-subtle/80 bg-background/14 px-3.5 py-2">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
          {trigger === "/"
            ? t("overlay.mentionCommands")
            : t("overlay.mentionServers")}
        </div>
        <div className="text-[10px] font-medium text-text-tertiary">
          {items.length} {items.length === 1 ? "item" : "items"}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-3.5 py-3 text-[12px] text-text-secondary">
          {emptyLabel}
        </div>
      ) : (
        <div
          className="overflow-y-auto py-1"
          style={{ maxHeight: Math.max(96, geometry.maxHeight - 45) }}
        >
          {items.map((item, i) => (
            <ZedListItem
              key={item.id}
              onMouseEnter={() => onHover(i)}
              onClick={() => onSelect(item)}
              selected={i === activeIndex}
              spacing="dense"
              className="mx-0.5 items-start px-2 py-1.5 text-[11px]"
              title={item.name}
              startSlot={
                <div className="mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-[8px] border border-border-subtle/80 bg-background/28">
                  <Icon className="h-3 w-3 text-text-tertiary" />
                </div>
              }
              endSlot={
                item.enabled === false ? (
                  <span className="shrink-0 rounded-[8px] border border-border-subtle/80 bg-background/28 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    off
                  </span>
                ) : null
              }
            >
              <span className="min-w-0 flex-1">
                <span className="block whitespace-normal break-words text-[11.5px] font-medium leading-[1.35] text-current">
                  {item.name}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block text-[10px] leading-[1.45] text-text-tertiary">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </ZedListItem>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
};

export default MentionPopup;
