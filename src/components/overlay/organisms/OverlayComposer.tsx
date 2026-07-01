import React from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, PointerOff, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OverlayAppearance } from "@/lib/overlayAppearance";
import { OverlayModelSelect } from "../OverlayModelSelect";
import { OverlaySttSelect } from "../OverlaySttSelect";
import { OverlayAiProfileSelect } from "../OverlayAiProfileSelect";
import MentionPopup, { type MentionItem } from "../MentionPopup";
import type { MentionMatch } from "../mentionUtils";
import { useOverlayStore } from "../../../stores/overlayStore";

type Props = {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onMouseDownInput: (e: React.MouseEvent<HTMLInputElement>) => void;
  attachedCount: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  mention: MentionMatch | null;
  mentionItems: MentionItem[];
  mentionIndex: number;
  setMention: (m: MentionMatch | null) => void;
  setMentionIndex: React.Dispatch<React.SetStateAction<number>>;
  onSelectMention: (item: MentionItem) => void;
  onSelectModel: React.ComponentProps<typeof OverlayModelSelect>["onSelect"];
  onSelectStt: React.ComponentProps<typeof OverlaySttSelect>["onSelect"];
  controlSurfaceClass: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onToggleMousePassthrough: () => void;
  appearance: OverlayAppearance;

};

/**
 * Zed-style agent composer: editor on top, footer toolbar below in one box.
 * Footer splits utility icons (left) and selectors + send (right).
 */
export default function OverlayComposer({
  onChange,
  onSubmit,
  onMouseDownInput,
  attachedCount,
  inputRef,
  mention,
  mentionItems,
  mentionIndex,
  setMention,
  setMentionIndex,
  onSelectMention,
  onSelectModel,
  onSelectStt,
  controlSurfaceClass,
  contentRef,
  onToggleMousePassthrough,
  appearance,
}: Props) {
  const {
    inputValue,
    stealthTapActive,
    currentModel,
    currentSttProfileId,
    currentSttLabel,
    isSettingsOpen,
    isMousePassthrough,
  } = useOverlayStore();
  const { t } = useTranslation();

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mention && mentionItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionItems.length) % mentionItems.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelectMention(mentionItems[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleOpenSettings = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isSettingsOpen) {
      window.electronAPI.toggleSettingsWindow();
      return;
    }
    if (!contentRef.current) return;
    const contentRect = contentRef.current.getBoundingClientRect();
    const buttonRect = e.currentTarget.getBoundingClientRect();
    const GAP = 8;
    const x = window.screenX + buttonRect.left;
    const y = window.screenY + contentRect.bottom + GAP;
    window.electronAPI.toggleSettingsWindow({ x, y });
  };

  const sendDisabled = !inputValue.trim() && attachedCount === 0;

  return (
    <div
      className="overlay-input-surface mt-1 rounded-xl border px-2.5 pt-2 pb-1.5 transition-shadow focus-within:ring-1 focus-within:ring-[color:var(--overlay-border-soft)]"
      style={appearance.inputStyle}
    >
      {attachedCount === 0 && (
        <div className="relative" data-stealth-engage="true">
          {mention && (
            <MentionPopup
              trigger={mention.trigger}
              items={mentionItems}
              activeIndex={mentionIndex}
              onSelect={onSelectMention}
              onHover={setMentionIndex}
              emptyLabel={
                mention.trigger === "/"
                  ? t("overlay.noSkillsYet")
                  : t("overlay.noMcpsYet")
              }
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={onChange}
            onKeyDown={handleInputKeyDown}
            onMouseDown={onMouseDownInput}
            readOnly={stealthTapActive}
            placeholder={t("overlay.composerPlaceholder")}
            className={`h-8 w-full border-0 bg-transparent py-1 px-1 text-[13.5px] leading-relaxed overlay-input-text transition-all duration-200 ease-sculpted placeholder:overlay-text-placeholder focus:outline-none ${stealthTapActive ? "rounded-md ring-1 ring-emerald-400/40" : ""}`}
          />
        </div>
      )}

      {/* Footer toolbar */}
      <div className="mt-1 flex items-center justify-between gap-2">
        {/* LEFT: utility icons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleOpenSettings}
            title={t("settings.title")}
            className={`w-7 h-7 flex items-center justify-center rounded-lg interaction-base interaction-press ${
              isSettingsOpen
                ? "overlay-icon-surface overlay-icon-surface-hover overlay-text-primary"
                : "overlay-text-muted hover:overlay-text-interactive hover:overlay-icon-surface-hover"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleMousePassthrough}
            title={t("overlay.mousePassthrough")}
            className={`w-7 h-7 flex items-center justify-center rounded-lg interaction-base interaction-press ${
              isMousePassthrough
                ? "overlay-icon-surface overlay-icon-surface-hover text-sky-400"
                : "overlay-text-muted hover:overlay-text-interactive hover:overlay-icon-surface-hover"
            }`}
          >
            <PointerOff className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* RIGHT: selectors + send */}
        <div className="flex items-center gap-1 min-w-0">
          <OverlayModelSelect
            currentModel={currentModel}
            onSelect={onSelectModel}
            className={controlSurfaceClass}
            controlStyle={appearance.controlStyle}
          />
          <OverlaySttSelect
            currentProfileId={currentSttProfileId}
            currentLabel={currentSttLabel}
            onSelect={onSelectStt}
            className={controlSurfaceClass}
            controlStyle={appearance.controlStyle}
          />
          <OverlayAiProfileSelect
            className={controlSurfaceClass}
            controlStyle={appearance.controlStyle}
          />

          <div className="w-px h-4 mx-0.5" style={appearance.dividerStyle} />

          <Button
            type="button"
            size="icon"
            onClick={onSubmit}
            disabled={sendDisabled}
            title={t("overlay.send")}
            className={cn(
              "h-7 w-7 rounded-lg interaction-base interaction-press shrink-0",
              sendDisabled && "overlay-icon-surface overlay-text-muted",
            )}
            style={sendDisabled ? appearance.iconStyle : undefined}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
