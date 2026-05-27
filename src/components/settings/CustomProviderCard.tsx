import React from "react";
import { useTranslation } from "react-i18next";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationCardShell } from "./IntegrationCardShell";
import { IntegrationCardSection } from "./IntegrationCardSection";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import {
  IntegrationActionBar,
  type IntegrationTestStatus,
} from "./IntegrationActionBar";
import { IntegrationTestResult } from "./IntegrationTestResult";
import { ProviderBrandIconBadge } from "./ProviderBrandIcon";

export interface CustomProviderItem {
  id: string;
  name: string;
  curlCommand: string;
  responsePath: string;
}

interface CustomProviderCardProps {
  provider: CustomProviderItem;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  testStatus: IntegrationTestStatus;
  testError?: string;
}

export function CustomProviderCard({
  provider,
  onEdit,
  onDelete,
  onTest,
  testStatus,
  testError,
}: CustomProviderCardProps) {
  const { t } = useTranslation();

  return (
    <IntegrationCardShell
      title={provider.name}
      subtitle={t("providers.customProvidersDesc")}
      category="cli"
      icon={<ProviderBrandIconBadge providerId="custom" />}
      defaultExpanded={false}
      badges={<IntegrationStatusBadge variant="configured" />}
      footer={
        <IntegrationActionBar
          onTest={onTest}
          testStatus={testStatus}
          extra={
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onEdit}>
              <Edit2 className="mr-1.5 h-3.5 w-3.5" />
              {t("common.edit")}
            </Button>
          }
          destructive={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("providers.remove")}
            </Button>
          }
        />
      }
      feedback={
        <IntegrationTestResult
          status={
            testStatus === "success"
              ? "success"
              : testStatus === "error"
                ? "error"
                : "idle"
          }
          message={
            testStatus === "success"
              ? t("providers.connectionSuccessful")
              : testError
          }
        />
      }
    >
      <IntegrationCardSection>
        <pre className="max-h-24 overflow-auto rounded-lg bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {provider.curlCommand}
        </pre>
        {provider.responsePath ? (
          <p className="font-mono text-[10px] text-muted-foreground/80">
            path: {provider.responsePath}
          </p>
        ) : null}
      </IntegrationCardSection>
    </IntegrationCardShell>
  );
}
