import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OverlayAppearance } from "@/lib/overlayAppearance";
import { useOverlayStore } from "../../../stores/overlayStore";

export interface AttachedShot {
  path: string;
  preview: string;
}

type Props = {
  items: AttachedShot[];
  onClearAll: () => void;
  onRemoveAt: (idx: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  isLightTheme: boolean;
  subtleSurfaceClass: string;
  inputClass: string;
  appearance: OverlayAppearance;

};

/** Thumbnails of attached screenshots + a question input for vision turns. */
export default function AttachedScreenshotPreview({
  items,
  onClearAll,
  onRemoveAt,
  inputRef,
  onInputChange,
  onSubmit,
  isLightTheme,
  subtleSurfaceClass,
  inputClass,
  appearance,
}: Props) {
  const {
    inputValue,
  } = useOverlayStore();
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div
      className={`mb-2 rounded-lg p-2 transition-all duration-200 border ${subtleSurfaceClass}`}
      style={appearance.subtleStyle}
      data-stealth-ignore="true"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium overlay-text-primary">
          {t("overlay.screenshotsAttached", { count: items.length })}
        </span>
        <button
          onClick={onClearAll}
          className="p-1 rounded-full transition-colors overlay-icon-surface overlay-icon-surface-hover overlay-text-interactive"
          title={t("overlay.removeAll")}
          style={appearance.iconStyle}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1">
        {items.map((ctx, idx) => (
          <div key={ctx.path} className="relative group/thumb flex-shrink-0">
            <img
              src={ctx.preview}
              alt={`Screenshot ${idx + 1}`}
              className={`h-10 w-auto rounded border ${isLightTheme ? "border-black/15" : "border-white/20"}`}
            />
            <button
              onClick={() => onRemoveAt(idx)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
              title={t("overlay.remove")}
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        onMouseDown={() => {
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        placeholder={t("overlay.askAboutScreenshot")}
        className={`mt-1.5 h-8 w-full rounded-lg border px-2.5 text-[12px] leading-snug transition-all duration-200 ease-sculpted focus:outline-none focus:ring-1 ${inputClass}`}
        style={appearance.inputStyle}
      />
    </div>
  );
}
