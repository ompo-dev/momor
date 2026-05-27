import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntegrationCardShell } from "./IntegrationCardShell";
import {
  IntegrationCardDivider,
  IntegrationCardSection,
} from "./IntegrationCardSection";
import {
  IntegrationActionBar,
  type IntegrationTestStatus,
} from "./IntegrationActionBar";
import { IntegrationTestResult } from "./IntegrationTestResult";
import {
  ApiKeysListEditor,
  type ApiKeyTestRowStatus,
} from "./ApiKeysListEditor";
import { ProviderBrandIconBadge } from "./ProviderBrandIcon";

const DEEPSEEK_MODELS = [
  { value: "deepseek-chat", label: "deepseek-chat" },
  { value: "deepseek-coder", label: "deepseek-coder" },
  { value: "deepseek-reasoner", label: "deepseek-reasoner" },
] as const;

interface DeepSeekProviderCardProps {
  storedKeys: string[];
  model: string;
  saving: boolean;
  saved: boolean;
  onModelChange: (model: string) => void;
  onSaveKeys: (keys: string[]) => Promise<void>;
  onRemoveAllKeys: () => Promise<void>;
  onTestConnection: (keys: string[]) => void;
  testStatus: IntegrationTestStatus;
  testError?: string;
  keyTestResults?: ApiKeyTestRowStatus[];
  keyTestErrors?: string[];
  onRemoveFromList?: () => void;
}

export function DeepSeekProviderCard({
  storedKeys,
  model,
  saving,
  saved,
  onModelChange,
  onSaveKeys,
  onRemoveAllKeys,
  onTestConnection,
  testStatus,
  testError,
  keyTestResults,
  keyTestErrors,
  onRemoveFromList,
}: DeepSeekProviderCardProps) {
  const { t } = useTranslation();
  const [keysDraft, setKeysDraft] = useState<string[]>(storedKeys);

  const hasStoredKeys = storedKeys.length > 0;
  const hasDraftKeys = keysDraft.some((k) => k.trim().length > 0);

  React.useEffect(() => {
    setKeysDraft(storedKeys);
  }, [storedKeys]);

  const handleSaveAll = async () => {
    await onSaveKeys(keysDraft.map((k) => k.trim()).filter(Boolean));
  };

  return (
    <IntegrationCardShell
      title="DeepSeek"
      subtitle={t("providers.categoryCloud")}
      category="cloud"
      icon={<ProviderBrandIconBadge providerId="deepseek" />}
      defaultExpanded={!hasStoredKeys}
      badges={
        <IntegrationStatusBadge
          variant={hasStoredKeys ? "configured" : "notConfigured"}
        />
      }
      footer={
        <IntegrationActionBar
          lead={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() =>
                window.electronAPI?.openExternal?.(
                  "https://platform.deepseek.com/api_keys",
                )
              }
            >
              {t("providers.getKey")}
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          }
          onTest={() =>
            onTestConnection(keysDraft.map((k) => k.trim()).filter(Boolean))
          }
          testStatus={testStatus}
          testDisabled={(!hasDraftKeys && !hasStoredKeys) || saving}
          extra={
            hasStoredKeys ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => void onRemoveAllKeys()}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("providers.clearAllKeys")}
              </Button>
            ) : undefined
          }
          save={
            <Button
              type="button"
              size="sm"
              className="h-8 min-w-[5.5rem] text-xs"
              disabled={saving || !hasDraftKeys}
              variant={saved ? "secondary" : "default"}
              onClick={() => void handleSaveAll()}
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
              ? t("providers.allKeysConnectionSuccessful", {
                  count: keysDraft.filter((k) => k.trim()).length || storedKeys.length,
                })
              : testError
          }
        />
      }
    >
      <IntegrationCardSection>
        <ApiKeysListEditor
          keys={storedKeys}
          onChange={setKeysDraft}
          disabled={saving}
          testResults={keyTestResults}
          testErrors={keyTestErrors}
        />
      </IntegrationCardSection>

      <IntegrationCardDivider />

      <IntegrationCardSection title={t("providers.modelLabel")}>
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
      </IntegrationCardSection>
    </IntegrationCardShell>
  );
}
