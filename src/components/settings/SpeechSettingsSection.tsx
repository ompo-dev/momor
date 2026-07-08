import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Plus } from "lucide-react";
import { SettingsSection } from "./layout/SettingsSection";
import {
  SettingsToolbar,
  SETTINGS_CONTROL_CLASS,
} from "./layout/SettingsToolbar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddSttProfileDialog } from "./AddSttProfileDialog";
import { SttProfileCard, type SttProfileView } from "./SttProfileCard";
import { cn } from "@/lib/utils";

interface SpeechSettingsSectionProps {
  isOpen: boolean;
}

export function SpeechSettingsSection({ isOpen }: SpeechSettingsSectionProps) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<SttProfileView[]>([]);
  const [defaultProfileId, setDefaultProfileId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!window.electronAPI?.getSttProfiles) {
      setProfiles([]);
      return;
    }
    setLoading(true);
    try {
      const res = await window.electronAPI.getSttProfiles();
      if (res?.success && Array.isArray(res.profiles)) {
        setProfiles(res.profiles as SttProfileView[]);
        setDefaultProfileId(res.defaultProfileId);
      }
    } catch (e) {
      console.error("Failed to load STT profiles:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void loadProfiles();
  }, [isOpen, loadProfiles]);

  useEffect(() => {
    if (!window.electronAPI?.onCredentialsChanged) return;
    return window.electronAPI.onCredentialsChanged(() => {
      if (isOpen) void loadProfiles();
    });
  }, [isOpen, loadProfiles]);

  const showFeedback = (
    type: "success" | "info" | "error",
    message: string,
    profileId?: string,
  ) => {
    setFeedback({ type, message });
    if (profileId) {
      setHighlightId(profileId);
      setTimeout(() => setHighlightId(null), 2500);
      requestAnimationFrame(() => {
        document
          .getElementById(`stt-profile-${profileId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSetDefault = async (profileId: string) => {
    await window.electronAPI?.setDefaultSttProfile?.(profileId);
    await loadProfiles();
    showFeedback("success", t("settings.audio.sttDefaultSet"));
  };

  const handleSaveProfile = async (updates: Partial<SttProfileView>) => {
    if (!updates.id) return;
    await window.electronAPI?.upsertSttProfile?.({
      id: updates.id,
      name: updates.name ?? "",
      kind: updates.kind ?? "none",
      enabled: updates.enabled !== false,
      apiKeys: updates.apiKeys,
      serviceAccountPath: updates.serviceAccountPath,
      region: updates.region,
      model: updates.model,
      baseUrl: updates.baseUrl,
    });
    await loadProfiles();
  };

  const handleDelete = async (profileId: string, profileName: string) => {
    if (!confirm(t("settings.audio.sttDeleteConfirm", { name: profileName })))
      return;
    await window.electronAPI?.deleteSttProfile?.(profileId);
    await loadProfiles();
    showFeedback("success", t("settings.audio.sttRemoved"));
  };

  const handleAddKind = async (kind: string) => {
    if (!window.electronAPI?.addSttPreset) {
      showFeedback("error", t("settings.audio.sttRestartRequired"));
      return;
    }
    try {
      const res = await window.electronAPI.addSttPreset(kind);
      await loadProfiles();
      if (!res?.success) {
        showFeedback("error", res?.error ?? t("settings.audio.sttAddFailed"));
        return;
      }
      const id = res.profile?.id;
      if (res.alreadyExists) {
        showFeedback(
          "info",
          t("settings.audio.sttAlreadyInList"),
          id ?? undefined,
        );
      } else {
        showFeedback(
          "success",
          t("settings.audio.sttAdded", {
            name: res.profile?.name ?? kind,
          }),
          id,
        );
      }
    } catch (e: unknown) {
      showFeedback(
        "error",
        e instanceof Error ? e.message : t("settings.audio.sttAddFailed"),
      );
    }
  };

  const hasProfiles = profiles.length > 0;
  const existingKinds = profiles.map((p) => p.kind);

  return (
    <SettingsSection
      title={t("settings.audio.speechProvider")}
      description={t("settings.audio.sttProfilesDesc")}
    >
      <AddSttProfileDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingKinds={existingKinds}
        onSelect={(kind) => void handleAddKind(kind)}
      />

      {!hasProfiles && !loading ? (
        <div className="border-l border-border-subtle/80 pl-4">
          <div className="flex items-center gap-2 text-text-tertiary">
            <Mic className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("settings.audio.speechProvider")}
            </span>
          </div>
          <p className="mt-2 max-w-md text-[12px] leading-5 text-muted-foreground">
            {t("settings.audio.sttEmptyHint")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-8 rounded-sm border-border-subtle/80 bg-background/20 px-3 text-[11px]"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("settings.audio.sttAdd")}
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-sm border border-border-subtle/80 bg-background/14 px-4 py-3.5">
            <SettingsToolbar
              label={t("settings.audio.sttDefaultProfile")}
              trailing={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`${SETTINGS_CONTROL_CLASS} rounded-sm border-border-subtle/80 bg-background/20 px-3 text-[11px]`}
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t("settings.audio.sttAdd")}
                </Button>
              }
              >
                <Select
                  value={defaultProfileId ?? ""}
                  onValueChange={(id) => void handleSetDefault(id)}
                  disabled={!hasProfiles}
                >
                  <SelectTrigger
                    className={`w-full ${SETTINGS_CONTROL_CLASS} rounded-sm border-border-subtle/80 bg-background/20 text-[12px]`}
                  >
                    <SelectValue placeholder={t("settings.audio.sttPickDefault")} />
                  </SelectTrigger>
                  <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.name}
                      {!p.configured ? ` · ${t("common.notConfigured")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsToolbar>
          </div>

          {feedback && (
            <div
              className={cn(
                "rounded-sm border px-3 py-2 text-[11px] leading-5",
                feedback.type === "success" &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                feedback.type === "info" &&
                  "border-primary/30 bg-primary/5 text-foreground",
                feedback.type === "error" &&
                  "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              {feedback.message}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                id={`stt-profile-${profile.id}`}
                className={cn(
                  "transition-all duration-300",
                  highlightId === profile.id &&
                    "border-l border-primary/70 pl-3",
                )}
              >
                <SttProfileCard
                  profile={profile}
                  isDefault={profile.id === defaultProfileId}
                  onSetDefault={() => void handleSetDefault(profile.id)}
                  onSave={handleSaveProfile}
                  onDelete={() => void handleDelete(profile.id, profile.name)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </SettingsSection>
  );
}
