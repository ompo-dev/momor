import React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ProviderBrandIcon } from "./ProviderBrandIcon";
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
  onLogin?: () => void;
  onLogout?: () => void;
  onRefreshAuth?: () => void;
  authLoggedIn?: boolean;
  authEmail?: string | null;
  authMethod?: string | null;
  authBusy?: boolean;
  authMessage?: string;
  saving?: boolean;
  saved?: boolean;
  testStatus: "idle" | "testing" | "success" | "error";
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
  onLogin,
  onLogout,
  onRefreshAuth,
  authLoggedIn,
  authEmail,
  authBusy,
  authMessage,
  saving,
  saved,
  testStatus,
  testError,
  onRemove,
}: CliProviderCardProps) {
  const { t } = useTranslation();

  const footer = (
    <>
      {onRefreshAuth && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
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
      <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving}>
        {saving ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
        ) : (
          <Save className="mr-1.5 h-3.5 w-3.5" />
        )}
        {saved ? t("providers.saved") : t("common.save")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void onTest()}
        disabled={testStatus === "testing"}
      >
        {testStatus === "testing" ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : testStatus === "success" ? (
          <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
        ) : testStatus === "error" ? (
          <AlertCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />
        ) : null}
        {t("providers.testConnection")}
      </Button>
    </>
  );

  return (
    <IntegrationCardShell
      title={title}
      subtitle={description}
      icon={
        iconId ? (
          <ProviderBrandIcon providerId={iconId} />
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
        <>
          {footer}
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8 text-xs text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              {t("providers.remove")}
            </Button>
          )}
        </>
      }
    >
      {(authLoggedIn || authMessage) && (
        <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
          {authLoggedIn && (
            <p className="text-emerald-600 dark:text-emerald-400">
              {t("providers.oauthLoggedIn")}
              {authEmail ? ` — ${authEmail}` : ""}
            </p>
          )}
          {authMessage && <p className="mt-1">{authMessage}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">{t("providers.cliPath")}</Label>
        <Input
          value={executablePath}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder={pathPlaceholder}
          className="h-9 font-mono text-xs"
        />
        {buildHint && (
          <p className="text-[11px] text-muted-foreground">{buildHint}</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {typeof timeoutMs === "number" && onTimeoutChange && (
          <div className="space-y-1.5">
            <Label className="text-xs">{t("providers.timeoutMs")}</Label>
            <Input
              type="number"
              min={1000}
              value={timeoutMs}
              onChange={(e) => onTimeoutChange(Number(e.target.value))}
              className="h-9 font-mono text-xs"
            />
          </div>
        )}
        {modelFields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-xs">{field.label}</Label>
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
          </div>
        ))}
      </div>

      {testError && (
        <p className="text-xs text-destructive">{testError}</p>
      )}
    </IntegrationCardShell>
  );
}
