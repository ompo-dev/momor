import React from "react";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  Database,
  ListTodo,
  MicOff,
  Shield,
  Smartphone,
  Users,
  WifiOff,
} from "lucide-react";
import { SettingsPage } from "./settings/layout/SettingsPage";
import { SettingsSection } from "./settings/layout/SettingsSection";

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 border-b border-border/50 px-4 py-3 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export const AboutSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SettingsPage
      title={t("about.title")}
      description={t("about.subtitle")}
      className="space-y-6"
    >
      <SettingsSection title={t("about.whatsNew")}>
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <FeatureRow
            icon={<Smartphone className="h-4 w-4" />}
            title={t("about.phoneLink.title")}
            description={t("about.phoneLink.desc")}
          />
          <FeatureRow
            icon={<ListTodo className="h-4 w-4" />}
            title={t("about.smartTask.title")}
            description={t("about.smartTask.desc")}
          />
          <FeatureRow
            icon={<Users className="h-4 w-4" />}
            title={t("about.speakerId.title")}
            description={t("about.speakerId.desc")}
          />
          <FeatureRow
            icon={<WifiOff className="h-4 w-4" />}
            title={t("about.offlineMode.title")}
            description={t("about.offlineMode.desc")}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("about.howItWorks")}>
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <FeatureRow
            icon={<Cpu className="h-4 w-4" />}
            title={t("about.hybridIntelligence.title")}
            description={t("about.hybridIntelligence.desc")}
          />
          <FeatureRow
            icon={<Database className="h-4 w-4" />}
            title={t("about.localRag.title")}
            description={t("about.localRag.desc")}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("about.privacy")}>
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex gap-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("about.stealthControl.title")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("about.stealthControl.desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <MicOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("about.noRecording.title")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("about.noRecording.desc")}
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>
    </SettingsPage>
  );
};
