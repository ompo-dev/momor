import React from "react";
import { useTranslation } from "react-i18next";
import { useOverlayStore } from "../../../stores/overlayStore";

type Props = {
  onDismissHotkeyConflict: () => void;
  stealthPermissionMissing: boolean;
  onDismissPermission: () => void;

};

/** Inline stealth banners: hotkey-conflict + accessibility-permission-missing. */
export default function OverlayStealthBanners({
  onDismissHotkeyConflict,
  stealthPermissionMissing,
  onDismissPermission,
}: Props) {
  const {
    stealthHotkeyConflict,
  } = useOverlayStore();
  const { t } = useTranslation();
  return (
    <>
      {stealthHotkeyConflict && (
        <div
          className="mb-2 px-3 py-2 rounded-xl border border-rose-400/40 bg-rose-500/10 text-[11px] flex items-center gap-2"
          data-stealth-ignore="true"
        >
          <span className="overlay-text-primary flex-1">
            {t("overlay.stealthHotkeyConflict", { hotkey: stealthHotkeyConflict })}
          </span>
          <button
            onClick={() => window.electronAPI.openSettingsTab("keybinds")}
            className="px-2 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 transition-colors text-[11px] font-medium overlay-text-primary whitespace-nowrap"
            data-stealth-ignore="true"
          >
            {t("overlay.rebind")}
          </button>
          <button
            onClick={onDismissHotkeyConflict}
            className="px-1.5 py-1 rounded-md hover:bg-white/10 transition-colors text-[11px] overlay-text-muted"
            aria-label="Dismiss"
            data-stealth-ignore="true"
          >
            ×
          </button>
        </div>
      )}

      {stealthPermissionMissing && (
        <div
          className="mb-2 px-3 py-2 rounded-xl border border-amber-400/40 bg-amber-500/10 text-[11px] flex items-center gap-2"
          data-stealth-ignore="true"
        >
          <span className="overlay-text-primary flex-1">
            {t("overlay.stealthPermissionMissing")}
          </span>
          <button
            onClick={() => window.electronAPI.stealthTapOpenSettings()}
            className="px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 transition-colors text-[11px] font-medium overlay-text-primary whitespace-nowrap"
            data-stealth-ignore="true"
          >
            {t("overlay.openSettings")}
          </button>
          <button
            onClick={onDismissPermission}
            className="px-1.5 py-1 rounded-md hover:bg-white/10 transition-colors text-[11px] overlay-text-muted"
            aria-label="Dismiss"
            data-stealth-ignore="true"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
