import React from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Loader2, Save, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntegrationCardShell } from "./IntegrationCardShell";
import { BackupKeysEditor } from "./BackupKeysEditor";
import { ProviderBrandIcon } from "./ProviderBrandIcon";

const DEEPSEEK_MODELS = [
  { value: "deepseek-chat", label: "deepseek-chat" },
  { value: "deepseek-coder", label: "deepseek-coder" },
  { value: "deepseek-reasoner", label: "deepseek-reasoner" },
] as const;

interface DeepSeekProviderCardProps {
  apiKey: string;
  model: string;
  hasStoredKey: boolean;
  saving: boolean;
  saved: boolean;
  onKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
  onSave: () => Promise<void>;
  onRemove: () => Promise<void>;
  onRemoveFromList?: () => void;
  backupKeysMasked?: string[];
  onSaveBackupKeys?: (keys: string[]) => Promise<void>;
}

export function DeepSeekProviderCard({
  apiKey,
  model,
  hasStoredKey,
  saving,
  saved,
  onKeyChange,
  onModelChange,
  onSave,
  onRemove,
  onRemoveFromList,
  backupKeysMasked = [],
  onSaveBackupKeys,
}: DeepSeekProviderCardProps) {
  const { t } = useTranslation();

  return (
    <IntegrationCardShell
      title="DeepSeek"
      subtitle={t("providers.categoryCloud")}
      icon={<ProviderBrandIcon providerId="deepseek" />}
      defaultExpanded={!hasStoredKey}
      badges={
        <IntegrationStatusBadge
          variant={hasStoredKey ? "configured" : "notConfigured"}
        />
      }
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() =>
              window.electronAPI?.openExternal?.(
                "https://platform.deepseek.com/api_keys",
              )
            }
          >
            {t("providers.getKey")}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || (!apiKey.trim() && !hasStoredKey)}
            onClick={() => void onSave()}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {saved ? t("providers.saved") : t("common.save")}
          </Button>
          {onRemoveFromList && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8 text-xs text-destructive hover:text-destructive"
              onClick={onRemoveFromList}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("providers.removeFromList")}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-1.5">
        <Label className="text-xs">{t("providers.apiKeyLabel")}</Label>
        <div className="flex gap-2">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={hasStoredKey ? t("providers.keySavedPlaceholder") : "sk-..."}
            className="h-9 flex-1 text-xs"
          />
          {hasStoredKey && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              title={t("providers.clearKey")}
              onClick={() => void onRemove()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {onSaveBackupKeys && (
        <BackupKeysEditor
          maskedKeys={backupKeysMasked}
          onSave={onSaveBackupKeys}
        />
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("providers.modelLabel")}</Label>
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEEPSEEK_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </IntegrationCardShell>
  );
}
