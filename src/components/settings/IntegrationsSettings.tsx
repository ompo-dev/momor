import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "./layout/SettingsPage";
import { AIProvidersSettings } from "./AIProvidersSettings";
import { SpeechSettingsSection } from "./SpeechSettingsSection";

interface IntegrationsSettingsProps {
  isOpen: boolean;
}

export function IntegrationsSettings({ isOpen }: IntegrationsSettingsProps) {
  const { t } = useTranslation();

  return (
    <SettingsPage
      title={t("settings.sidebar.integrations")}
      description={t("providers.integrationsDesc")}
      className="space-y-8"
    >
      <AIProvidersSettings isOpen={isOpen} />
      <SpeechSettingsSection isOpen={isOpen} />
    </SettingsPage>
  );
}
