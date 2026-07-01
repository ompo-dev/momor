import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Callout } from "@/components/ui/callout";
import { useOverlayStore } from "../../../stores/overlayStore";

type Props = {
  onDismissSystemAudio: () => void;
  onDismissStt: () => void;

};

/** Top-of-overlay warning banners: screen-recording denied + STT not configured. */
export default function OverlayWarningBanners({
  onDismissSystemAudio,
  onDismissStt,
}: Props) {
  const {
    systemAudioWarning,
    sttNotConfigured,
  } = useOverlayStore();
  const { t } = useTranslation();
  return (
    <>
      {systemAudioWarning && (
        <Callout
          severity="warning"
          borderPosition="none"
          title={t("overlay.screenRecordingDenied")}
          description={systemAudioWarning}
          className="no-drag relative mx-4 mt-3 mb-1 rounded-lg border border-[#dec184]/25"
          actions={
            <button
              onClick={() =>
                window.electronAPI.openExternal(
                  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
                )
              }
              className="no-drag inline-flex h-7 items-center rounded-md border border-[#dec184]/30 bg-[#dec184]/15 px-2.5 text-[11px] font-medium text-[#9a7424] transition-colors hover:bg-[#dec184]/25 active:scale-95 dark:text-[#dec184]"
            >
              {t("overlay.openSettings")}
            </button>
          }
          dismiss={
            <button
              onClick={onDismissSystemAudio}
              title="Dismiss"
              className="no-drag inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          }
        />
      )}

      {sttNotConfigured && (
        <div className="flex items-center justify-between mx-4 mt-3 mb-1 px-3.5 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-[12px] shadow-sm relative no-drag group/stt-warning">
          <div className="flex flex-col gap-1 pr-3">
            <div className="flex items-center gap-2 text-[12.5px] text-orange-600 dark:text-orange-400/90 font-medium leading-tight">
              <div className="shrink-0 p-1 bg-orange-500/20 rounded-full">
                <svg
                  className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
              <span>{t("overlay.transcriptionNotConfigured")}</span>
            </div>
            <p className="text-[11px] text-orange-600/70 dark:text-orange-400/60 leading-snug pl-[26px]">
              {t("overlay.noSttProvider")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.electronAPI?.toggleSettingsWindow?.()}
              className="px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-700 dark:text-orange-500 text-[11px] font-semibold transition-all active:scale-95 border border-orange-500/20 shadow-sm"
            >
              {t("overlay.openSettings")}
            </button>
            <button
              onClick={onDismissStt}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-orange-600/50 hover:text-orange-700 dark:text-orange-500/50 dark:hover:text-orange-400 transition-colors absolute top-1 right-1 opacity-0 group-hover/stt-warning:opacity-100"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
