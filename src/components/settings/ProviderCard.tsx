import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Trash2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntegrationCardShell } from "./IntegrationCardShell";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import { BackupKeysEditor } from "./BackupKeysEditor";
import { ProviderBrandIcon } from "./ProviderBrandIcon";

interface FetchedModel {
  id: string;
  label: string;
}

interface ProviderCardProps {
  providerId: "gemini" | "groq" | "openai" | "claude";
  providerName: string;
  apiKey: string;
  preferredModel?: string;
  hasStoredKey: boolean;
  onKeyChange: (key: string) => void;
  onSaveKey: () => Promise<void>;
  onRemoveKey: () => void;
  onTestConnection: () => void;
  testStatus: "idle" | "testing" | "success" | "error";
  testError?: string;
  savingStatus: boolean;
  savedStatus: boolean;
  keyPlaceholder: string;
  keyUrl: string;
  onPreferredModelChange?: (modelId: string) => void;
  oauthAlternativeNote?: string;
  onRemoveFromList?: () => void;
  backupKeysMasked?: string[];
  onSaveBackupKeys?: (keys: string[]) => Promise<void>;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  providerId,
  providerName,
  apiKey,
  preferredModel,
  hasStoredKey,
  onKeyChange,
  onSaveKey,
  onRemoveKey,
  onTestConnection,
  testStatus,
  testError,
  savingStatus,
  savedStatus,
  keyPlaceholder,
  keyUrl,
  onPreferredModelChange,
  oauthAlternativeNote,
  onRemoveFromList,
  backupKeysMasked = [],
  onSaveBackupKeys,
}) => {
  const { t } = useTranslation();
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(preferredModel || "");

  const savedRef = useRef(savedStatus);
  const savingRef = useRef(savingStatus);
  savedRef.current = savedStatus;
  savingRef.current = savingStatus;

  useEffect(() => {
    if (!apiKey.trim()) return;
    const timer = setTimeout(() => {
      if (!savedRef.current && !savingRef.current) {
        onSaveKey().catch(console.error);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [apiKey, onSaveKey]);

  useEffect(() => {
    if (preferredModel) setSelectedModel(preferredModel);
  }, [preferredModel]);

  const handleFetchModels = async () => {
    setIsFetching(true);
    setFetchError(null);
    try {
      const result = await window.electronAPI?.fetchProviderModels?.(
        providerId,
        apiKey,
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

  const footer = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onTestConnection}
        disabled={(!apiKey.trim() && !hasStoredKey) || testStatus === "testing"}
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
      <Button
        size="sm"
        onClick={onSaveKey}
        disabled={savingStatus || !apiKey.trim()}
        variant={savedStatus ? "secondary" : "default"}
      >
        {savingStatus ? t("common.saving") : savedStatus ? t("providers.saved") : t("common.save")}
      </Button>
      {hasStoredKey && (
        <Button
          variant="secondary"
          size="sm"
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
      )}
    </>
  );

  return (
    <IntegrationCardShell
      title={providerName}
      subtitle={t("providers.categoryCloud")}
      icon={<ProviderBrandIcon providerId={providerId} />}
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
            onClick={() => window.electronAPI?.openExternal?.(keyUrl)}
          >
            {t("providers.getKey")}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
          {footer}
          {onRemoveFromList && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8 text-xs text-destructive hover:text-destructive"
              onClick={onRemoveFromList}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t("providers.removeFromList")}
            </Button>
          )}
        </>
      }
    >
      {oauthAlternativeNote && (
        <p className="rounded-md border border-border/50 bg-muted/25 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {oauthAlternativeNote}
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">{t("providers.apiKeyLabel")}</Label>
        <div className="flex gap-2">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={hasStoredKey ? t("providers.keySavedPlaceholder") : keyPlaceholder}
            className="h-9 flex-1 text-xs"
          />
          {hasStoredKey && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              onClick={onRemoveKey}
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

      {modelOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t("providers.modelLabel")}</Label>
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
        </div>
      )}

      {testError && (
        <p className="text-xs text-destructive">{testError}</p>
      )}
      {fetchError && (
        <p className="text-xs text-destructive">{fetchError}</p>
      )}
    </IntegrationCardShell>
  );
};
