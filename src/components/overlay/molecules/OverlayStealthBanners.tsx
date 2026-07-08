import React from "react";
import { Keyboard, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Callout } from "../../ui/callout";
import { useOverlayStore } from "../../../stores/overlayStore";

type Props = {
  onDismissHotkeyConflict: () => void;
  stealthPermissionMissing: boolean;
  onDismissPermission: () => void;
};

/** Inline stealth banners: hotkey conflict + accessibility permission. */
export default function OverlayStealthBanners({
  onDismissHotkeyConflict,
  stealthPermissionMissing,
  onDismissPermission,
}: Props) {
  const { stealthHotkeyConflict } = useOverlayStore();
  const { t } = useTranslation();

  return (
    <>
      {stealthHotkeyConflict && (
        <div
          className="mb-1.5 overflow-hidden rounded-[10px] border border-border-subtle/75 bg-background/12"
          data-stealth-ignore="true"
        >
          <Callout
            severity="error"
            borderPosition="none"
            className="bg-rose-500/[0.05]"
            icon={<Keyboard size={16} />}
            title={
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  Stealth
                </span>
                <span className="text-[13px] font-medium text-text-primary">
                  {t("overlay.stealthHotkeyConflict", {
                    hotkey: stealthHotkeyConflict,
                  })}
                </span>
              </div>
            }
            actions={
              <button
                onClick={() => window.electronAPI.openSettingsTab("keybinds")}
                className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-[8px] border border-border-subtle/80 bg-background/28 px-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-primary transition-colors hover:bg-background/40"
                data-stealth-ignore="true"
              >
                {t("overlay.rebind")}
              </button>
            }
            dismiss={
              <button
                onClick={onDismissHotkeyConflict}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-text-tertiary transition-colors hover:bg-background/38 hover:text-text-primary"
                aria-label="Dismiss"
                data-stealth-ignore="true"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            }
          />
        </div>
      )}

      {stealthPermissionMissing && (
        <div
          className="mb-1.5 overflow-hidden rounded-[10px] border border-border-subtle/75 bg-background/12"
          data-stealth-ignore="true"
        >
          <Callout
            severity="warning"
            borderPosition="none"
            className="bg-amber-500/[0.05]"
            icon={<TriangleAlert size={16} />}
            title={
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  Stealth
                </span>
                <span className="text-[13px] font-medium text-text-primary">
                  {t("overlay.stealthPermissionMissing")}
                </span>
              </div>
            }
            actions={
              <button
                onClick={() => window.electronAPI.stealthTapOpenSettings()}
                className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-[8px] border border-border-subtle/80 bg-background/28 px-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-primary transition-colors hover:bg-background/40"
                data-stealth-ignore="true"
              >
                {t("overlay.openSettings")}
              </button>
            }
            dismiss={
              <button
                onClick={onDismissPermission}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-text-tertiary transition-colors hover:bg-background/38 hover:text-text-primary"
                aria-label="Dismiss"
                data-stealth-ignore="true"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            }
          />
        </div>
      )}
    </>
  );
}
