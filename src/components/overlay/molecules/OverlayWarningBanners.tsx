import React from "react";
import { Settings2, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Callout } from "../../ui/callout";
import { useOverlayStore } from "../../../stores/overlayStore";

type Props = {
  onDismissSystemAudio: () => void;
  onDismissStt: () => void;
};

type SystemAudioWarningKind = "permission" | "attention";

function classifySystemAudioWarning(message: string): SystemAudioWarningKind {
  const normalized = message.toLowerCase();
  if (normalized.includes("no audio detected")) {
    return "attention";
  }
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

function humanizeSystemAudioWarning(
  message: string,
  kind: SystemAudioWarningKind,
  isMacPlatform: boolean,
  isPortuguese: boolean,
): string {
  const normalized = message.toLowerCase();

  if (kind === "permission") {
    if (isMacPlatform) {
      return isPortuguese
        ? "O Momor precisa da permissao de Gravacao de Tela para capturar o audio da reuniao. Abra os ajustes do sistema, confira o app e reinicie a reuniao."
        : "Momor needs Screen Recording permission to capture meeting audio. Open System Settings, confirm the app, then restart the meeting.";
    }
    return isPortuguese
      ? "A captura do audio do sistema ainda nao esta pronta. Revise o dispositivo de saida e a configuracao em Integracoes antes de tentar de novo."
      : "System audio capture is not ready yet. Review the output device and the Integrations settings before trying again.";
  }

  if (
    normalized.includes("airpods") ||
    normalized.includes("virtual cable") ||
    normalized.includes("default output") ||
    normalized.includes("no audio detected")
  ) {
    return isPortuguese
      ? "Nenhum audio utilizavel chegou ao app. Troque a reuniao para o dispositivo de saida padrao do sistema e tente iniciar novamente."
      : "No usable audio reached the app. Switch the meeting to the system default output device and try starting it again.";
  }

  return message;
}

/** Top-of-overlay warning banners: screen/audio capture problems + STT not configured. */
export default function OverlayWarningBanners({
  onDismissSystemAudio,
  onDismissStt,
}: Props) {
  const { systemAudioWarning, sttNotConfigured } = useOverlayStore();
  const { t, i18n } = useTranslation();
  const isPortuguese = i18n.language.startsWith("pt");

  const warningKind = systemAudioWarning
    ? classifySystemAudioWarning(systemAudioWarning)
    : null;
  const isPermissionWarning = warningKind === "permission";
  const isMacPlatform = window.electronAPI?.platform === "darwin";
  const macPermissionFlow = isPermissionWarning && isMacPlatform;
  const shouldOpenSystemSettings = macPermissionFlow;
  const bannerSeverity = macPermissionFlow ? "warning" : "info";
  const bannerBadgeLabel = macPermissionFlow
    ? t("overlay.systemPermissionBadge")
    : t("overlay.systemAudioBadge");
  const bannerTitle = macPermissionFlow
    ? t("overlay.systemCapturePermissionTitle")
    : t("overlay.systemAudioWarningTitle");
  const systemAudioBody =
    systemAudioWarning && warningKind
      ? humanizeSystemAudioWarning(
          systemAudioWarning,
          warningKind,
          isMacPlatform,
          isPortuguese,
        )
      : "";
  const systemAudioActionLabel = shouldOpenSystemSettings
    ? t("overlay.openSystemSettings")
    : isPortuguese
      ? "Abrir integracoes"
      : "Open integrations";

  const handleSystemAudioAction = () => {
    if (!systemAudioWarning) return;
    if (shouldOpenSystemSettings) {
      void window.electronAPI?.openScreenCaptureSettings?.();
      return;
    }
    void window.electronAPI?.openSettingsTab?.("integrations");
  };

  return (
    <>
      {systemAudioWarning && (
        <div className="no-drag mx-4 mb-1 mt-2 overflow-hidden rounded-[10px] border border-border-subtle/75 bg-background/12">
          <Callout
            severity={bannerSeverity}
            borderPosition="none"
            className={
              macPermissionFlow ? "bg-amber-500/[0.05]" : "bg-transparent"
            }
            icon={<TriangleAlert size={16} />}
            title={
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  {bannerBadgeLabel}
                </span>
                <span className="text-[13px] font-medium text-text-primary">
                  {bannerTitle}
                </span>
              </div>
            }
            description={
              <div className="text-[12px] leading-5 text-text-secondary">
                {systemAudioBody}
              </div>
            }
            actions={
              <button
                onClick={handleSystemAudioAction}
                className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[8px] border border-border-subtle/80 bg-background/28 px-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-primary transition-colors hover:bg-background/40"
              >
                <Settings2 className="h-3 w-3" />
                {systemAudioActionLabel}
              </button>
            }
            dismiss={
              <button
                onClick={onDismissSystemAudio}
                title={t("common.close")}
                className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] text-text-tertiary transition-colors hover:bg-background/38 hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            }
          />
        </div>
      )}

      {sttNotConfigured && (
        <div className="no-drag mx-4 mb-1 mt-2 overflow-hidden rounded-[10px] border border-border-subtle/75 bg-background/12">
          <Callout
            severity="warning"
            borderPosition="none"
            className="bg-orange-500/[0.05]"
            icon={<TriangleAlert size={16} />}
            title={
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  STT
                </span>
                <span className="text-[13px] font-medium text-text-primary">
                  {t("overlay.transcriptionNotConfigured")}
                </span>
              </div>
            }
            description={
              <div className="text-[12px] leading-5 text-text-secondary">
                {t("overlay.noSttProvider")}
              </div>
            }
            actions={
              <button
                onClick={() =>
                  window.electronAPI?.openSettingsTab?.("integrations")
                }
                className="inline-flex h-6 shrink-0 items-center rounded-[8px] border border-border-subtle/80 bg-background/28 px-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-primary transition-colors hover:bg-background/40"
              >
                {t("overlay.configureInMomor")}
              </button>
            }
            dismiss={
              <button
                onClick={onDismissStt}
                className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] text-text-tertiary transition-colors hover:bg-background/38 hover:text-text-primary"
                title={t("common.close")}
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
