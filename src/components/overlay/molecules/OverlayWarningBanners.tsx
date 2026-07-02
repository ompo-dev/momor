import React from "react";
import { Settings2, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOverlayStore } from "../../../stores/overlayStore";

type Props = {
  onDismissSystemAudio: () => void;
  onDismissStt: () => void;
};

type SystemAudioWarningKind = "permission" | "attention";

function classifySystemAudioWarning(message: string): SystemAudioWarningKind {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("screen recording") ||
    normalized.includes("screencapturekit") ||
    normalized.includes("privacy & security") ||
    normalized.includes("tcc")
  ) {
    return "permission";
  }
  return "attention";
}

/** Top-of-overlay warning banners: screen/audio capture problems + STT not configured. */
export default function OverlayWarningBanners({
  onDismissSystemAudio,
  onDismissStt,
}: Props) {
  const { systemAudioWarning, sttNotConfigured } = useOverlayStore();
  const { t } = useTranslation();

  const warningKind = systemAudioWarning
    ? classifySystemAudioWarning(systemAudioWarning)
    : null;
  const isPermissionWarning = warningKind === "permission";

  const handleSystemAudioAction = () => {
    if (!systemAudioWarning) return;
    if (isPermissionWarning) {
      void window.electronAPI?.openScreenCaptureSettings?.();
      return;
    }
    void window.electronAPI?.openSettingsTab?.("integrations");
  };

  return (
    <>
      {systemAudioWarning && (
        <div className="group no-drag relative mx-4 mt-3 mb-1 overflow-hidden rounded-2xl border border-amber-200/12 bg-[linear-gradient(135deg,rgba(48,40,26,0.96),rgba(34,30,22,0.92))] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-amber-200/90 via-amber-300/55 to-transparent" />
          <div className="flex items-start gap-3 px-4 py-3.5">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200/16 bg-amber-200/8 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <TriangleAlert className="h-4.5 w-4.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[14px] font-semibold leading-tight text-[#f6efe1]">
                  {isPermissionWarning
                    ? t("overlay.systemCapturePermissionTitle")
                    : t("overlay.systemAudioWarningTitle")}
                </h3>
                <span className="rounded-full border border-amber-200/16 bg-amber-200/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/80">
                  {isPermissionWarning
                    ? t("overlay.systemPermissionBadge")
                    : t("overlay.systemAudioBadge")}
                </span>
              </div>

              <p className="mt-1 text-[12.5px] leading-6 text-[#d8cfbf]">
                {systemAudioWarning}
              </p>
            </div>

            <div className="flex shrink-0 items-start gap-2 self-start">
              <button
                onClick={handleSystemAudioAction}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-200/14 bg-amber-200/10 px-3 text-[11px] font-semibold text-amber-100 transition-all hover:bg-amber-200/16 hover:text-[#fff7e7] active:scale-[0.98]"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {isPermissionWarning
                  ? t("overlay.openSystemSettings")
                  : t("overlay.configureInMomor")}
              </button>

              <button
                onClick={onDismissSystemAudio}
                title={t("common.close")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-amber-100/55 transition-colors hover:bg-white/6 hover:text-amber-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {sttNotConfigured && (
        <div className="group/stt-warning no-drag relative mx-4 mt-3 mb-1 flex items-center justify-between rounded-[12px] border border-orange-500/20 bg-orange-500/10 px-3.5 py-2.5 shadow-sm">
          <div className="flex flex-col gap-1 pr-3">
            <div className="flex items-center gap-2 text-[12.5px] font-medium leading-tight text-orange-600 dark:text-orange-400/90">
              <div className="shrink-0 rounded-full bg-orange-500/20 p-1">
                <svg
                  className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400"
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
            <p className="pl-[26px] text-[11px] leading-snug text-orange-600/70 dark:text-orange-400/60">
              {t("overlay.noSttProvider")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => window.electronAPI?.openSettingsTab?.("integrations")}
              className="rounded-lg border border-orange-500/20 bg-orange-500/15 px-3 py-1.5 text-[11px] font-semibold text-orange-700 shadow-sm transition-all hover:bg-orange-500/25 active:scale-95 dark:text-orange-500"
            >
              {t("overlay.configureInMomor")}
            </button>
            <button
              onClick={onDismissStt}
              className="absolute top-1 right-1 rounded-full p-1.5 text-orange-600/50 transition-colors hover:bg-black/5 hover:text-orange-700 group-hover/stt-warning:opacity-100 dark:text-orange-500/50 dark:hover:bg-white/10 dark:hover:text-orange-400"
              title={t("common.close")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
