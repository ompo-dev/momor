import React from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
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

interface FetchedModel {
  id: string;
  label: string;
}

interface ProviderCardProps {
  providerId: "gemini" | "groq" | "openai" | "claude";
  providerName: string;
  storedKeys: string[];
  preferredModel?: string;
  onSaveKeys: (keys: string[]) => Promise<void>;
  onRemoveAllKeys: () => void;
  onTestConnection: (keys: string[]) => void;
  testStatus: IntegrationTestStatus;
  testError?: string;
  keyTestResults?: ApiKeyTestRowStatus[];
  keyTestErrors?: string[];
  savingStatus: boolean;
  savedStatus: boolean;
  keyUrl: string;
  onPreferredModelChange?: (modelId: string) => void;
  oauthAlternativeNote?: string;
  onRemoveFromList?: () => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  providerId,
  providerName,
  storedKeys,
  preferredModel,
  onSaveKeys,
  onRemoveAllKeys,
  onTestConnection,
  testStatus,
  testError,
  keyTestResults,
  keyTestErrors,
  savingStatus,
  savedStatus,
  keyUrl,
  onPreferredModelChange,
  oauthAlternativeNote,
  onRemoveFromList,
}) => {
  const { t } = useTranslation();
  const [fetchedModels, setFetchedModels] = React.useState<FetchedModel[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<string>(
    preferredModel || "",
  );
  const [keysDraft, setKeysDraft] = React.useState<string[]>(storedKeys);

  const hasStoredKeys = storedKeys.length > 0;
  const hasDraftKeys = keysDraft.some((k) => k.trim().length > 0);

  React.useEffect(() => {
    setKeysDraft(storedKeys);
  }, [storedKeys]);

  React.useEffect(() => {
    if (preferredModel) setSelectedModel(preferredModel);
  }, [preferredModel]);

  const handleSaveAll = async () => {
    const cleaned = keysDraft.map((k) => k.trim()).filter(Boolean);
    await onSaveKeys(cleaned);
  };

  const handleFetchModels = async () => {
    setIsFetching(true);
    setFetchError(null);
    const activeKey =
      keysDraft.map((k) => k.trim()).find(Boolean) || storedKeys[0] || "";
    try {
      const result = await window.electronAPI?.fetchProviderModels?.(
        providerId,
        activeKey,
      );
      if (result?.success && result.models) {
        setFetchedModels(result.models);
        if (result.models.length > 0) {
          const existsInList = result.models.some(
            (m: FetchedModel) => m.id === selectedModel,
          );
          if (!existsInList) {
            const firstModel = result.models[0].id;
            setSelectedModel(firstModel);
            await window.electronAPI?.setProviderPreferredModel?.(
              providerId,
              firstModel,
            );
            onPreferredModelChange?.(firstModel);
          }
        }
      } else {
        setFetchError(result?.error || t("common.fetchModelsFailed"));
      }
    } catch (e: unknown) {
      setFetchError(
        e instanceof Error ? e.message : t("common.fetchModelsFailed"),
      );
    } finally {
      setIsFetching(false);
    }
  };

  const handleSelectModel = async (modelId: string) => {
    setSelectedModel(modelId);
    try {
      await window.electronAPI?.setProviderPreferredModel?.(providerId, modelId);
      onPreferredModelChange?.(modelId);
    } catch (e) {
      console.error("Failed to save preferred model:", e);
    }
  };

  const modelOptions =
    fetchedModels.length > 0
      ? fetchedModels
      : preferredModel
        ? [{ id: preferredModel, label: preferredModel }]
        : [];

  return (
    <IntegrationCardShell
      title={providerName}
      subtitle={t("providers.categoryCloud")}
      category="cloud"
      icon={<ProviderBrandIconBadge providerId={providerId} />}
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
              onClick={() => window.electronAPI?.openExternal?.(keyUrl)}
            >
              {t("providers.getKey")}
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          }
          onTest={() =>
            onTestConnection(keysDraft.map((k) => k.trim()).filter(Boolean))
          }
          testStatus={testStatus}
          testDisabled={(!hasDraftKeys && !hasStoredKeys) || savingStatus}
          extra={
            hasStoredKeys ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleFetchModels}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("providers.fetchModels")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={onRemoveAllKeys}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("providers.clearAllKeys")}
                </Button>
              </>
            ) : undefined
          }
          save={
            <Button
              size="sm"
              className="h-8 min-w-[5.5rem] text-xs"
              onClick={() => void handleSaveAll()}
              disabled={savingStatus || !hasDraftKeys}
              variant={savedStatus ? "secondary" : "default"}
            >
              {savingStatus
                ? t("common.saving")
                : savedStatus
                  ? t("providers.saved")
                  : t("common.save")}
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
                ? t("providers.allKeysConnectionSuccessful", {
                    count: keysDraft.filter((k) => k.trim()).length || storedKeys.length,
                    defaultValue: "Todas as chaves OK",
                  })
                : testError
            }
          />
          {fetchError ? (
            <p className="text-[11px] text-destructive">{fetchError}</p>
          ) : null}
        </>
      }
    >
      {oauthAlternativeNote && (
        <p className="rounded-lg bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {oauthAlternativeNote}
        </p>
      )}

      <IntegrationCardSection>
        <ApiKeysListEditor
          keys={storedKeys}
          onChange={setKeysDraft}
          disabled={savingStatus}
          testResults={keyTestResults}
          testErrors={keyTestErrors}
        />
      </IntegrationCardSection>

      {modelOptions.length > 0 && (
        <>
          <IntegrationCardDivider />
          <IntegrationCardSection title={t("providers.modelLabel")}>
            <Select value={selectedModel} onValueChange={handleSelectModel}>
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue placeholder={t("providers.selectModel")} />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="text-xs">
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </IntegrationCardSection>
        </>
      )}
    </IntegrationCardShell>
  );
};
