import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationCardShell } from "./IntegrationCardShell";
import {
  IntegrationCardDivider,
  IntegrationCardSection,
} from "./IntegrationCardSection";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import { IntegrationActionBar } from "./IntegrationActionBar";
import { IntegrationTestResult } from "./IntegrationTestResult";
import { IntegrationField } from "./IntegrationField";
import {
  ApiKeysListEditor,
  type ApiKeyTestRowStatus,
} from "./ApiKeysListEditor";
import { SttBrandIconBadge } from "./SttBrandIcon";
import { SttLiveTestPanel } from "./SttLiveTestPanel";
import { sttKindLabel } from "./integrationDisplay";
import { LocalWhisperModelPanel } from "@/components/LocalWhisperModelPanel";
import type { IntegrationTestStatus } from "./IntegrationActionBar";

export interface SttProfileView {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  configured: boolean;
  hasApiKey?: boolean;
  apiKeys?: string[];
  region?: string;
  model?: string;
  baseUrl?: string;
  serviceAccountPath?: string;
}

interface SttProfileCardProps {
  profile: SttProfileView;
  isDefault: boolean;
  onSetDefault: () => void;
  onSave: (updates: Partial<SttProfileView>) => Promise<void>;
  onDelete: () => void;
}

const NEEDS_KEY = new Set([
  "groq",
  "openai",
  "deepgram",
  "elevenlabs",
  "azure",
  "ibmwatson",
  "soniox",
]);

export function SttProfileCard({
  profile,
  isDefault,
  onSetDefault,
  onSave,
  onDelete,
}: SttProfileCardProps) {
  const { t } = useTranslation();
  const storedKeys = profile.apiKeys ?? [];
  const [keysDraft, setKeysDraft] = useState<string[]>(storedKeys);
  const [region, setRegion] = useState(profile.region || "eastus");
  const [groqModel, setGroqModel] = useState(
    profile.model || "whisper-large-v3-turbo",
  );
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<IntegrationTestStatus>("idle");
  const [connectionError, setConnectionError] = useState("");
  const [keyTestResults, setKeyTestResults] = useState<ApiKeyTestRowStatus[]>(
    [],
  );
  const [keyTestErrors, setKeyTestErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [saveError, setSaveError] = useState("");

  const needsKey = NEEDS_KEY.has(profile.kind);
  const isGoogle = profile.kind === "google";
  const isGroq = profile.kind === "groq";
  const isLocal = profile.kind === "local-whisper";
  const hasDraftKeys = keysDraft.some((k) => k.trim().length > 0);
  const canTestConnection =
    needsKey || isGoogle || isLocal || profile.configured;

  useEffect(() => {
    setKeysDraft(storedKeys);
  }, [storedKeys.join("\u0000"), profile.id]);

  const buildUpdates = (): Partial<SttProfileView> => {
    const updates: Partial<SttProfileView> = {
      id: profile.id,
      name: profile.name,
      kind: profile.kind,
      enabled: true,
    };
    if (needsKey) {
      updates.apiKeys = keysDraft.map((k) => k.trim()).filter(Boolean);
    }
    if (profile.kind === "azure" || profile.kind === "ibmwatson") {
      updates.region = region;
    }
    if (isGroq) updates.model = groqModel;
    return updates;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveStatus("idle");
    try {
      await onSave(buildUpdates());
      setSaveStatus("success");
    } catch (e: unknown) {
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const keys = keysDraft.map((k) => k.trim()).filter(Boolean);
    setConnectionStatus("testing");
    setConnectionError("");
    setKeyTestResults(keys.map(() => "testing" as ApiKeyTestRowStatus));
    setKeyTestErrors(keys.map(() => ""));

    try {
      const regionArg =
        profile.kind === "azure" || profile.kind === "ibmwatson"
          ? region
          : undefined;
      const testResult = await window.electronAPI?.testSttConnection?.(
        profile.id,
        keys.length ? keys : undefined,
        regionArg,
      );

      if (testResult?.keyResults?.length) {
        setKeyTestResults(
          testResult.keyResults.map((r) =>
            r.success ? "success" : "error",
          ) as ApiKeyTestRowStatus[],
        );
        setKeyTestErrors(
          testResult.keyResults.map((r) => r.error ?? ""),
        );
      } else if (testResult?.success) {
        setKeyTestResults(keys.map(() => "success"));
      }

      if (!testResult?.success) {
        setConnectionStatus("error");
        setConnectionError(
          testResult?.error || t("common.connectionFailed"),
        );
        return;
      }
      setConnectionStatus("success");
      setTimeout(() => {
        setConnectionStatus("idle");
        setKeyTestResults([]);
        setKeyTestErrors([]);
      }, 3000);
    } catch (e: unknown) {
      setConnectionStatus("error");
      setConnectionError(
        e instanceof Error ? e.message : t("common.connectionFailed"),
      );
      setKeyTestResults(keysDraft.map(() => "error"));
    }
  };

  const displayName = sttKindLabel(profile.kind, profile.name);
  const displaySubtitle =
    profile.kind === "local-whisper"
      ? t("settings.audio.localWhisperDesc")
      : profile.kind === "google"
        ? t("settings.audio.googleSttDesc", {
            defaultValue: "Google Cloud Speech-to-Text",
          })
        : t("providers.categoryCloud");

  const feedbackMessage =
    connectionStatus === "error"
      ? connectionError
      : connectionStatus === "success"
        ? t("providers.allKeysConnectionSuccessful", {
            count: keysDraft.filter((k) => k.trim()).length || storedKeys.length,
          })
        : saveStatus === "error"
          ? saveError
          : saveStatus === "success"
            ? t("providers.saved")
            : undefined;

  const feedbackStatus =
    connectionStatus === "error" || saveStatus === "error"
      ? "error"
      : connectionStatus === "success" || saveStatus === "success"
        ? "success"
        : "idle";

  return (
    <IntegrationCardShell
      title={displayName}
      subtitle={displaySubtitle}
      category={isLocal ? "local" : "cloud"}
      icon={<SttBrandIconBadge kind={profile.kind} />}
      isDefault={isDefault}
      defaultExpanded={!profile.configured || isDefault}
      badges={
        <>
          {isDefault ? <IntegrationStatusBadge variant="default" /> : null}
          <IntegrationStatusBadge
            variant={profile.configured ? "configured" : "notConfigured"}
          />
        </>
      }
      footer={
        <IntegrationActionBar
          onTest={canTestConnection ? () => void handleTestConnection() : undefined}
          testStatus={connectionStatus}
          testDisabled={
            needsKey && storedKeys.length === 0 && !hasDraftKeys
          }
          extra={
            !isDefault ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={onSetDefault}
              >
                <Star className="mr-1.5 h-3.5 w-3.5" />
                {t("settings.audio.sttSetDefault")}
              </Button>
            ) : undefined
          }
          save={
            needsKey || isGoogle ? (
              <Button
                type="button"
                size="sm"
                className="h-8 min-w-[5.5rem] text-xs"
                disabled={saving || (needsKey && !hasDraftKeys)}
                onClick={() => void handleSave()}
              >
                {saving && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            ) : undefined
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
        feedbackMessage ? (
          <IntegrationTestResult
            status={feedbackStatus}
            message={feedbackMessage}
            onDismiss={() => {
              setConnectionStatus("idle");
              setConnectionError("");
              setSaveStatus("idle");
              setSaveError("");
            }}
          />
        ) : null
      }
    >
      {isGoogle && (
        <IntegrationCardSection title={t("settings.audio.serviceAccount")}>
          <div className="flex gap-2">
            <div className="flex min-h-9 min-w-0 flex-1 items-center truncate rounded-md border border-input bg-background px-3 text-xs font-mono text-muted-foreground">
              {profile.serviceAccountPath?.split(/[/\\]/).pop() ||
                t("settings.audio.noServiceAccount")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 px-3"
              onClick={async () => {
                const result =
                  await window.electronAPI?.selectServiceAccount?.();
                if (result?.success && result.path) {
                  await onSave({ ...profile, serviceAccountPath: result.path });
                }
              }}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {t("settings.audio.selectFile")}
            </Button>
          </div>
        </IntegrationCardSection>
      )}

      {isGroq && (
        <IntegrationCardSection title={t("providers.modelLabel")}>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "whisper-large-v3-turbo", label: "V3 Turbo" },
              { id: "whisper-large-v3", label: "V3" },
            ].map((m) => (
              <Button
                key={m.id}
                type="button"
                size="sm"
                className="h-8 text-xs"
                variant={groqModel === m.id ? "default" : "outline"}
                onClick={() => setGroqModel(m.id)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </IntegrationCardSection>
      )}

      {needsKey && (
        <IntegrationCardSection>
          {(profile.kind === "azure" || profile.kind === "ibmwatson") && (
            <IntegrationField label={t("common.region")}>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder={
                  profile.kind === "azure" ? "eastus" : "us-south"
                }
                className="h-9 text-xs"
              />
            </IntegrationField>
          )}

          <ApiKeysListEditor
            keys={storedKeys}
            onChange={setKeysDraft}
            disabled={saving}
            testResults={keyTestResults}
            testErrors={keyTestErrors}
          />
        </IntegrationCardSection>
      )}

      {isLocal && (
        <>
          <IntegrationCardDivider />
          <LocalWhisperModelPanel
            embedded
            onModelChange={(modelId) =>
              void onSave({
                id: profile.id,
                name: profile.name,
                kind: profile.kind,
                enabled: true,
                model: modelId,
              })
            }
          />
        </>
      )}

      <SttLiveTestPanel
        profileId={profile.id}
        disabled={!profile.configured && !hasDraftKeys && needsKey}
      />
    </IntegrationCardShell>
  );
}
