import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Cable,
  CircleHelp,
  Keyboard,
  LayoutGrid,
  Play,
} from "lucide-react";
import logoAsset from "../assets/logo.png";
import { ZedListItem } from "./zed/ZedListItem";
import { ZedKeyBinding } from "./zed/ZedKeyBinding";

interface StartupSequenceProps {
  onComplete: () => void;
  onStartMeeting?: () => void;
  onOpenSettings?: (tab: string) => void;
}

function StartupAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <ZedListItem
      onClick={onClick}
      startSlot={icon}
      spacing="sparse"
      className="min-h-[50px] rounded-sm border border-border-subtle/70 bg-secondary/16 px-2.5 py-2 text-text-primary"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] font-medium text-text-primary">
          {title}
        </span>
        <span className="text-[11px] leading-5 text-text-tertiary">
          {description}
        </span>
      </div>
    </ZedListItem>
  );
}

const StartupSequence: React.FC<StartupSequenceProps> = ({
  onComplete,
  onStartMeeting,
  onOpenSettings,
}) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[100] bg-background text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex h-full w-full max-w-[900px] items-center justify-center px-6 py-10"
      >
        <div className="w-full max-w-[760px] overflow-hidden rounded-md border border-border-subtle/80 bg-background/96 shadow-[0_36px_90px_-56px_rgba(0,0,0,0.92)]">
          <div className="border-b border-border-subtle/80 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-secondary/30">
                  <img
                    src={logoAsset}
                    alt="Momor"
                    className="h-5.5 w-5.5 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                    Momor
                  </p>
                  <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.04em] text-text-primary">
                    {t("startup.welcome")}
                  </h1>
                  <p className="mt-2 max-w-[34rem] text-[13px] leading-6 text-text-secondary">
                    {t("startup.subtitle")}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <ZedKeyBinding keys={["Enter"]} />
              </div>
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_236px]">
            <div className="px-3 py-3 sm:px-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {t("startup.getStarted")}
                </span>
                <div className="h-px flex-1 bg-border-subtle/80" />
              </div>

              <div className="space-y-1.5">
                <StartupAction
                  icon={<LayoutGrid className="h-3.5 w-3.5" />}
                  title={t("startup.openHome")}
                  description={t("startup.openHomeDesc")}
                  onClick={onComplete}
                />
                <StartupAction
                  icon={<Play className="h-3.5 w-3.5 fill-current" />}
                  title={t("startup.startMeeting")}
                  description={t("startup.startMeetingDesc")}
                  onClick={() => {
                    onComplete();
                    onStartMeeting?.();
                  }}
                />
                <StartupAction
                  icon={<Cable className="h-3.5 w-3.5" />}
                  title={t("startup.configureIntegrations")}
                  description={t("startup.configureIntegrationsDesc")}
                  onClick={() => {
                    onComplete();
                    onOpenSettings?.("integrations");
                  }}
                />
                <StartupAction
                  icon={<Keyboard className="h-3.5 w-3.5" />}
                  title={t("startup.customizeKeybinds")}
                  description={t("startup.customizeKeybindsDesc")}
                  onClick={() => {
                    onComplete();
                    onOpenSettings?.("keybinds");
                  }}
                />
                <StartupAction
                  icon={<CircleHelp className="h-3.5 w-3.5" />}
                  title={t("startup.reviewHelp")}
                  description={t("startup.reviewHelpDesc")}
                  onClick={() => {
                    onComplete();
                    onOpenSettings?.("help");
                  }}
                />
              </div>
            </div>

            <div className="border-t border-border-subtle/80 px-4 py-3 md:border-l md:border-t-0 sm:px-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {t("startup.configure")}
                </span>
                <div className="h-px flex-1 bg-border-subtle/80" />
              </div>

              <div className="space-y-3">
                <p className="text-[11px] leading-5 text-text-tertiary">
                  {t("startup.footer")}
                </p>
                <div className="rounded-sm border border-border-subtle/80 bg-background/30 px-3 py-2">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                    {t("startup.openHome")}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                    {t("startup.openHomeDesc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StartupSequence;
