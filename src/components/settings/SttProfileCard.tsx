import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntegrationCardShell } from "./IntegrationCardShell";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import { BackupKeysEditor } from "./BackupKeysEditor";
import { sttKindLabel } from "./integrationDisplay";
import { LocalWhisperModelPanel } from "@/components/LocalWhisperModelPanel";

export interface SttProfileView {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  configured: boolean;
  hasApiKey?: boolean;
  apiKey?: string;
  region?: string;
  model?: string;
  baseUrl?: string;
  serviceAccountPath?: string;
  backupApiKeys?: string[];
}

interface SttProfileCardProps {
  profile: SttProfileView;
  isDefault: boolean;
  onSetDefault: () => void;
  onSave: (updates: Partial<SttProfileView>) => Promise<void>;
  onDelete: () => void;
}

function isMaskedKey(value: string) {
  return !value.trim() || value.includes("...");
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

const KIND_ICON: Record<string, string> = {
  deepgram: "DG",
  groq: "GQ",
  openai: "OA",
  google: "GC",
  "local-whisper": "LW",
  elevenlabs: "EL",
  azure: "AZ",
  soniox: "SX",
  ibmwatson: "IBM",
};

export function SttProfileCard({
  profile,
  isDefault,
  onSetDefault,
  onSave,
  onDelete,
}: SttProfileCardProps) {
  const { t } = useTranslation();
  const [draftKey, setDraftKey] = useState("");
  const [backupKeysDraft, setBackupKeysDraft] = useState<string[]>(
    profile.backupApiKeys ?? [],
  );
  const [region, setRegion] = useState(profile.region || "eastus");
  const [groqModel, setGroqModel] = useState(
    profile.model || "whisper-large-v3-turbo",
  );
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testError, setTestError] = useState("");

  const needsKey = NEEDS_KEY.has(profile.kind);
  const isGoogle = profile.kind === "google";
  const isGroq = profile.kind === "groq";
  const isLocal = profile.kind === "local-whisper";

  useEffect(() => {
    setBackupKeysDraft(profile.backupApiKeys ?? []);
  }, [profile.backupApiKeys, profile.id]);

  const handleSave = async () => {
    setSaving(true);
    setTestStatus("testing");
    setTestError("");
    try {
      const updates: Partial<SttProfileView> = {
        id: profile.id,
        name: profile.name,
        kind: profile.kind,
        enabled: true,
      };
      if (needsKey && draftKey.trim() && !isMaskedKey(draftKey)) {
        updates.apiKey = draftKey.trim();
      }
      if (needsKey) {
        updates.backupApiKeys = backupKeysDraft
          .map((k) => k.trim())
          .filter((k) => k && !isMaskedKey(k));
      }
      if (profile.kind === "azure" || profile.kind === "ibmwatson") {
        updates.region = region;
      }
      if (isGroq) updates.model = groqModel;
      await onSave(updates);

      if (needsKey && (profile.hasApiKey || draftKey.trim())) {
        const testResult = await window.electronAPI?.testSttConnection?.(
          profile.kind as "groq",
          "",
          profile.kind === "azure" ? region : undefined,
        );
        if (!testResult?.success) {
          setTestStatus("error");
          setTestError(testResult?.error || t("common.connectionFailed"));
          return;
        }
      }
      setDraftKey("");
      setTestStatus("success");
      setTimeout(() => setTestStatus("idle"), 2500);
    } catch (e: unknown) {
      setTestStatus("error");
      setTestError(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      {!isDefault && (
        <Button type="button" variant="secondary" size="sm" onClick={onSetDefault}>
          <Star className="mr-1.5 h-3.5 w-3.5" />
          {t("settings.audio.sttSetDefault")}
        </Button>
      )}
      {(needsKey || isGoogle) && (
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {t("common.save")}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        {t("providers.remove")}
      </Button>
    </>
  );

  const displayName = sttKindLabel(profile.kind, profile.name);
  const displaySubtitle =
    profile.kind === "local-whisper"
      ? t("settings.audio.localWhisperDesc")
      : profile.kind === "google"
        ? t("settings.audio.googleSttDesc", {
            defaultValue: "Google Cloud Speech-to-Text",
          })
        : t("providers.categoryCloud");

  return (
    <IntegrationCardShell
      title={displayName}
      subtitle={displaySubtitle}
      icon={KIND_ICON[profile.kind] ?? "ST"}
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
      footer={footer}
    >
      {isGoogle && (
        <div className="space-y-2">
          <Label className="text-xs">{t("settings.audio.serviceAccount")}</Label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1 truncate rounded-md border border-input bg-background px-2.5 py-2 text-xs font-mono">
              {profile.serviceAccountPath?.split(/[/\\]/).pop() ||
                t("settings.audio.noServiceAccount")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={async () => {
                const result =
                  await window.electronAPI?.selectServiceAccount?.();
                if (result?.success && result.path) {
                  await onSave({ ...profile, serviceAccountPath: result.path });
                }
              }}
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {isGroq && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            {t("providers.modelLabel")}
          </Label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "whisper-large-v3-turbo", label: "V3 Turbo" },
              { id: "whisper-large-v3", label: "V3" },
            ].map((m) => (
              <Button
                key={m.id}
                type="button"
                size="sm"
                variant={groqModel === m.id ? "default" : "outline"}
                onClick={() => setGroqModel(m.id)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {needsKey && (
        <div className="space-y-2">
          <Label className="text-xs">{t("providers.apiKeyLabel")}</Label>
          <Input
            type="password"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder={
              profile.hasApiKey
                ? t("providers.keySavedPlaceholder")
                : t("providers.enterApiKey")
            }
            className="h-9 text-xs"
          />
          {profile.kind === "azure" && (
            <div className="space-y-1">
              <Label className="text-xs">{t("common.region")}</Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="eastus"
                className="h-9 text-xs"
              />
            </div>
          )}
          <BackupKeysEditor
            maskedKeys={backupKeysDraft}
            onSave={async (keys) => {
              setBackupKeysDraft(keys);
              await onSave({
                id: profile.id,
                name: profile.name,
                kind: profile.kind,
                enabled: true,
                backupApiKeys: keys,
              });
            }}
          />
        </div>
      )}

      {isLocal && (
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
      )}

      {testStatus === "error" && testError && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {testError}
        </p>
      )}
      {testStatus === "success" && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          {t("providers.connectionSuccessful")}
        </p>
      )}
    </IntegrationCardShell>
  );
}
