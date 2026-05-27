import React from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntegrationCardShell } from "./IntegrationCardShell";
import { IntegrationCardSection } from "./IntegrationCardSection";
import {
  IntegrationActionBar,
  type IntegrationTestStatus,
} from "./IntegrationActionBar";
import { IntegrationTestResult } from "./IntegrationTestResult";
import { IntegrationField } from "./IntegrationField";
import { ProviderBrandIconBadge } from "./ProviderBrandIcon";
import type { IntegrationId } from "./integrationTypes";

export interface CliModelFieldConfig {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export interface CliProviderCardProps {
  title: string;
  description: string;
  iconId?: IntegrationId;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  executablePath: string;
  onPathChange: (path: string) => void;
  pathPlaceholder: string;
  modelFields: CliModelFieldConfig[];
  timeoutMs?: number;
  onTimeoutChange?: (ms: number) => void;
  buildHint?: string;
  onSave: () => Promise<void>;
  onTest: () => Promise<void>;
  testLabel?: string;
  onSecondaryTest?: () => Promise<void>;
  secondaryTestLabel?: string;
  secondaryTestStatus?: IntegrationTestStatus;
  secondaryTestError?: string;
  onLogin?: () => void;
  onLogout?: () => void;
  onRefreshAuth?: () => void;
  authLoggedIn?: boolean;
  authEmail?: string | null;
  authMethod?: string;
  authBusy?: boolean;
  authMessage?: string;
  saving?: boolean;
  saved?: boolean;
  testStatus: IntegrationTestStatus;
  testError?: string;
  onRemove?: () => void;
}

export function CliProviderCard({
  title,
  description,
  iconId,
  enabled,
  onEnabledChange,
  executablePath,
  onPathChange,
  pathPlaceholder,
  modelFields,
  timeoutMs,
  onTimeoutChange,
  buildHint,
  onSave,
  onTest,
  testLabel,
  onSecondaryTest,
  secondaryTestLabel,
  secondaryTestStatus,
  secondaryTestError,
  onLogin,
  onLogout,
  onRefreshAuth,
  authLoggedIn,
  authEmail,
  authMethod,
  authBusy,
  authMessage,
  saving,
  saved,
  testStatus,
  testError,
  onRemove,
}: CliProviderCardProps) {
  const { t } = useTranslation();

  const oauthButtons = (
    <>
      {onRefreshAuth && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={onRefreshAuth}
          disabled={authBusy}
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${authBusy ? "animate-spin" : ""}`}
          />
          {t("providers.oauthRefresh")}
        </Button>
      )}
      {authLoggedIn && onLogout ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onLogout}
          disabled={authBusy}
        >
          {authBusy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t("providers.oauthLogout")}
        </Button>
      ) : (
        onLogin && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onLogin}
            disabled={authBusy}
          >
            {authBusy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogIn className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("providers.oauthLogin")}
          </Button>
        )
      )}
    </>
  );

  return (
    <IntegrationCardShell
      title={title}
      subtitle={description}
      category="cli"
      icon={
        iconId ? (
          <ProviderBrandIconBadge providerId={iconId} />
        ) : (
          title.charAt(0).toUpperCase()
        )
      }
      defaultExpanded={enabled}
      badges={
        enabled ? <IntegrationStatusBadge variant="enabled" /> : undefined
      }
      headerActions={
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label={title}
        />
      }
      footer={
        <IntegrationActionBar
          onTest={() => void onTest()}
          testLabel={testLabel ?? t("providers.testConnection")}
          testStatus={testStatus}
          onSecondaryTest={
            onSecondaryTest ? () => void onSecondaryTest() : undefined
          }
          secondaryTestLabel={secondaryTestLabel}
          secondaryTestStatus={secondaryTestStatus}
          extra={oauthButtons}
          save={
            <Button
              type="button"
              size="sm"
              className="h-8 min-w-[5.5rem] text-xs"
              onClick={() => void onSave()}
              disabled={saving}
              variant={saved ? "secondary" : "default"}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {saved ? t("providers.saved") : t("common.save")}
            </Button>
          }
          destructive={
            onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={onRemove}
              >
                {t("providers.remove")}
              </Button>
            ) : undefined
          }
        />
      }
      feedback={
        <>
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
          {secondaryTestError ? (
            <IntegrationTestResult status="error" message={secondaryTestError} />
          ) : null}
        </>
      }
    >
      {(authLoggedIn || authMessage) && (
        <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
          {authLoggedIn && (
            <p>
              {t("providers.oauthLoggedIn")}
              {authEmail ? ` — ${authEmail}` : ""}
              {authMethod && authMethod !== "none"
                ? ` (${authMethod})`
                : ""}
            </p>
          )}
          {authMessage && <p className="mt-1 text-muted-foreground">{authMessage}</p>}
        </div>
      )}

      <IntegrationCardSection>
        <IntegrationField label={t("providers.cliPath")}>
          <Input
            value={executablePath}
            onChange={(e) => onPathChange(e.target.value)}
            placeholder={pathPlaceholder}
            className="h-9 font-mono text-xs"
          />
          {buildHint && (
            <p className="mt-1 text-[10px] text-muted-foreground">{buildHint}</p>
          )}
        </IntegrationField>

        {typeof timeoutMs === "number" && onTimeoutChange && (
          <IntegrationField label={t("providers.timeoutMs")}>
            <Input
              type="number"
              min={1000}
              value={timeoutMs}
              onChange={(e) => onTimeoutChange(Number(e.target.value))}
              className="h-9 font-mono text-xs"
            />
          </IntegrationField>
        )}

        {modelFields.map((field) => (
          <IntegrationField key={field.id} label={field.label}>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </IntegrationField>
        ))}
      </IntegrationCardSection>
    </IntegrationCardShell>
  );
}
