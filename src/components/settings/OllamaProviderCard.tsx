import React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Wrench,
} from "lucide-react";
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

export type OllamaStatus = "checking" | "detected" | "not-found" | "fixing";

interface OllamaProviderCardProps {
  status: OllamaStatus;
  models: string[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onAutoFix: () => void;
  onTestConnection: () => void;
  testStatus: IntegrationTestStatus;
  testError?: string;
  onRemoveFromList?: () => void;
}

export function OllamaProviderCard({
  status,
  models,
  isRefreshing,
  onRefresh,
  onAutoFix,
  onTestConnection,
  testStatus,
  testError,
  onRemoveFromList,
}: OllamaProviderCardProps) {
  const { t } = useTranslation();
  const configured = status === "detected";

  return (
    <IntegrationCardShell
      title={t("providers.ollama")}
      subtitle={t("providers.categoryLocal")}
      category="local"
      icon={<ProviderBrandIconBadge providerId="ollama" />}
      defaultExpanded={!configured}
      badges={
        <IntegrationStatusBadge
          variant={configured ? "configured" : "notConfigured"}
        />
      }
      footer={
        <IntegrationActionBar
          onTest={onTestConnection}
          testStatus={testStatus}
          testDisabled={status === "checking" || status === "fixing"}
          extra={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                />
                {t("common.refresh")}
              </Button>
              {status === "not-found" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onAutoFix}
                >
                  <Wrench className="mr-1.5 h-3.5 w-3.5" />
                  {t("providers.ollamaAutoFix")}
                </Button>
              )}
            </>
          }
          destructive={
            onRemoveFromList ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={onRemoveFromList}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("providers.removeFromList")}
              </Button>
            ) : undefined
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
      {status === "checking" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("providers.checkingOllama")}
        </p>
      )}
      {status === "fixing" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("providers.fixingOllama")}
        </p>
      )}
      {status === "not-found" && (
        <IntegrationCardSection>
          <p className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {t("providers.ollamaNotDetected")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("providers.ollamaEnsureRunning")}
          </p>
        </IntegrationCardSection>
      )}
      {status === "detected" && models.length > 0 && (
        <IntegrationCardSection title={t("providers.ollamaConnected")}>
          <div className="grid gap-1.5">
            {models.map((model) => (
              <div
                key={model}
                className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
              >
                <span className="truncate font-mono text-xs">{model}</span>
                <span className="rounded-full bg-background px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  local
                </span>
              </div>
            ))}
          </div>
        </IntegrationCardSection>
      )}
      {status === "detected" && models.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-3.5 w-3.5" />
          {t("providers.ollamaNoModels")}
        </p>
      )}
    </IntegrationCardShell>
  );
}
