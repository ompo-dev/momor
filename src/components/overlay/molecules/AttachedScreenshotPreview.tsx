import React from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OverlayAppearance } from "@/lib/overlayAppearance";

export interface AttachedShot {
  path: string;
  preview: string;
}

type Props = {
  items: AttachedShot[];
  onClearAll: () => void;
  onRemoveAt: (idx: number) => void;
  isLightTheme: boolean;
  subtleSurfaceClass: string;
  appearance: OverlayAppearance;
};

/** Thumbnails of attached screenshots + a question input for vision turns. */
export default function AttachedScreenshotPreview({
  items,
  onClearAll,
  onRemoveAt,
  isLightTheme,
  subtleSurfaceClass,
  appearance,
}: Props) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div
      className={`mb-2 overflow-hidden rounded-[10px] border border-border-subtle/80 transition-all duration-200 ${subtleSurfaceClass}`}
      style={appearance.subtleStyle}
      data-stealth-ignore="true"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle/80 bg-background/14 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-[8px] border border-border-subtle/80 bg-background/28 text-text-tertiary">
            <ImageIcon className="h-3 w-3" />
          </span>
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {t("overlay.visualContext")}
            </div>
            <div className="truncate text-[11px] text-text-secondary">
              {t("overlay.screenshotsAttached", { count: items.length })}
            </div>
          </div>
        </div>
        <button
          onClick={onClearAll}
          className="inline-flex h-5.5 shrink-0 items-center rounded-[8px] border border-border-subtle/80 bg-background/24 px-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-secondary transition-colors hover:bg-background/34 hover:text-text-primary"
          title={t("overlay.removeAll")}
        >
          {t("overlay.removeAll")}
        </button>
      </div>

      <div className="flex max-w-full gap-2 overflow-x-auto px-2.5 py-2">
        {items.map((ctx, idx) => (
          <div
            key={ctx.path}
            className={`group/thumb relative flex shrink-0 items-center gap-2 rounded-[9px] border px-2 py-1.5 ${
              isLightTheme
                ? "border-black/12 bg-white/45"
                : "border-border-subtle/80 bg-background/18"
            }`}
          >
            <img
              src={ctx.preview}
              alt={`Screenshot ${idx + 1}`}
              className={`h-8 w-[52px] rounded-[7px] border object-cover ${
                isLightTheme ? "border-black/15" : "border-white/16"
              }`}
            />
            <div className="flex min-w-[64px] flex-col pr-4">
              <span className="text-[10.5px] font-medium text-text-primary">
                {t("overlay.imageLabel", { index: idx + 1 })}
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-tertiary">
                {t("overlay.visualContext")}
              </span>
            </div>
            <button
              onClick={() => onRemoveAt(idx)}
              className="absolute right-1.5 top-1.5 inline-flex h-4.5 w-4.5 items-center justify-center rounded-[7px] border border-border-subtle/80 bg-background/72 text-text-tertiary transition-colors hover:bg-background/86 hover:text-text-primary"
              title={t("overlay.remove")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
