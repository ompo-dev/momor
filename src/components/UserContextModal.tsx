import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  Check,
  Ear,
  Plus,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { ModalShell } from "./shell/ModalShell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./settings/layout/SettingsSection";
import {
  createAiBehaviorProfile,
  createDefaultUserSessionData,
  loadUserSessionData,
  saveUserSessionData,
  SESSION_PRESET_KEYS,
  type AiBehaviorProfile,
  type SessionPresetKey,
  type UserSessionData,
} from "@/lib/userSessionContext";
import { syncUserSessionContextToMain } from "@/lib/syncUserSessionContextToMain";

interface UserContextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileToggleRowProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  nested?: boolean;
}

function ProfileToggleRow({
  id,
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  nested = false,
}: ProfileToggleRowProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-4 py-3.5",
        nested && "border-l-2 border-primary/30 bg-muted/15 pl-5",
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
            {title}
          </Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-1 shrink-0"
      />
    </div>
  );
}

export function UserContextModal({ isOpen, onClose }: UserContextModalProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<UserSessionData>(createDefaultUserSessionData);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("default");
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const loaded = loadUserSessionData();
    setData(loaded);
    setSelectedProfileId(
      loaded.profiles.find((p) => p.isDefault)?.id ?? loaded.profiles[0]?.id ?? "default",
    );
  }, [isOpen]);

  const persist = useCallback((next: UserSessionData) => {
    setData(next);
    saveUserSessionData(next);
    void syncUserSessionContextToMain(next);
    setSavedHint(true);
    window.setTimeout(() => setSavedHint(false), 1500);
  }, []);

  const selectedProfile =
    data.profiles.find((p) => p.id === selectedProfileId) ?? data.profiles[0];

  const updateProfile = (profileId: string, patch: Partial<AiBehaviorProfile>) => {
    persist({
      ...data,
      profiles: data.profiles.map((p) =>
        p.id === profileId ? { ...p, ...patch } : p,
      ),
    });
  };

  const addProfile = () => {
    const profile = createAiBehaviorProfile(t("userContext.newProfileName"));
    persist({
      ...data,
      profiles: [...data.profiles, profile],
    });
    setSelectedProfileId(profile.id);
  };

  const deleteProfile = (profileId: string) => {
    if (data.profiles.length <= 1) return;

    const remaining = data.profiles.filter((p) => p.id !== profileId);
    const hadDefault = data.profiles.find((p) => p.id === profileId)?.isDefault;
    const normalized = hadDefault
      ? remaining.map((p, i) => ({ ...p, isDefault: i === 0 }))
      : remaining;

    persist({ ...data, profiles: normalized });
    if (selectedProfileId === profileId) {
      setSelectedProfileId(normalized[0]?.id ?? "default");
    }
  };

  const setDefaultProfile = (profileId: string) => {
    persist({
      ...data,
      profiles: data.profiles.map((p) => ({
        ...p,
        isDefault: p.id === profileId,
      })),
    });
  };

  const applySessionPreset = (key: SessionPresetKey) => {
    persist({
      ...data,
      sessionContext: t(`userContext.sessionPresets.${key}`),
    });
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl h-[85vh]"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{t("userContext.title")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("userContext.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {savedHint && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                {t("userContext.saved")}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <Tabs defaultValue="personal" className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-4 pt-4">
          <TabsList className="w-full shrink-0 grid grid-cols-3">
            <TabsTrigger value="personal">{t("userContext.tabs.personal")}</TabsTrigger>
            <TabsTrigger value="session">{t("userContext.tabs.session")}</TabsTrigger>
            <TabsTrigger value="profiles">{t("userContext.tabs.profiles")}</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-4 min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <Label htmlFor="personal-context">{t("userContext.personalLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("userContext.personalHint")}
              </p>
              <Textarea
                id="personal-context"
                value={data.personalContext}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, personalContext: e.target.value }))
                }
                onBlur={(e) =>
                  persist({ ...data, personalContext: e.target.value })
                }
                placeholder={t("userContext.personalPlaceholder")}
                className="min-h-[280px] flex-1 resize-none"
              />
            </div>
          </TabsContent>

          <TabsContent value="session" className="mt-4 min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div>
                <Label>{t("userContext.sessionPresetsLabel")}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SESSION_PRESET_KEYS.map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => applySessionPreset(key)}
                    >
                      {t(`userContext.sessionPresetNames.${key}`)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <Label htmlFor="session-context">{t("userContext.sessionLabel")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("userContext.sessionHint")}
                </p>
                <Textarea
                  id="session-context"
                  value={data.sessionContext}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, sessionContext: e.target.value }))
                  }
                  onBlur={(e) =>
                    persist({ ...data, sessionContext: e.target.value })
                  }
                  placeholder={t("userContext.sessionPlaceholder")}
                  className="min-h-[220px] flex-1 resize-none"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profiles" className="mt-4 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex min-h-0 flex-1 gap-5 overflow-hidden">
              <aside className="flex w-[220px] shrink-0 flex-col gap-3 self-start">
                <div className="flex items-center justify-between px-0.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("userContext.profilesList")}
                  </Label>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {data.profiles.length}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-muted/10">
                  <div className="max-h-[min(280px,32vh)] overflow-y-auto p-2">
                    <div className="flex flex-col gap-1.5">
                      {data.profiles.map((profile) => {
                        const selected = profile.id === selectedProfileId;
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => setSelectedProfileId(profile.id)}
                            className={cn(
                              "group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                              selected
                                ? "border-primary/40 bg-primary/5 shadow-sm"
                                : "border-transparent hover:border-border/80 hover:bg-muted/50",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                                selected
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground group-hover:text-foreground",
                              )}
                            >
                              <Brain className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-medium">
                                  {profile.name}
                                </span>
                                {profile.isDefault && (
                                  <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {profile.activeListening && (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 px-1.5 text-[10px] font-normal"
                                  >
                                    {t("userContext.activeListeningBadge")}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full shrink-0 justify-center gap-1.5"
                  onClick={addProfile}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("userContext.addProfile")}
                </Button>
              </aside>

              {selectedProfile && (
                <ScrollArea className="min-h-0 min-w-0 flex-1">
                  <div className="flex flex-col gap-5 pr-3 pb-2">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Label htmlFor="profile-name">
                            {t("userContext.profileName")}
                          </Label>
                          <Input
                            id="profile-name"
                            value={selectedProfile.name}
                            onChange={(e) =>
                              updateProfile(selectedProfile.id, {
                                name: e.target.value,
                              })
                            }
                            className="h-10"
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant={
                              selectedProfile.isDefault ? "secondary" : "outline"
                            }
                            size="sm"
                            className="h-9 gap-1.5"
                            onClick={() => setDefaultProfile(selectedProfile.id)}
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                selectedProfile.isDefault &&
                                  "fill-amber-400 text-amber-400",
                              )}
                            />
                            {selectedProfile.isDefault
                              ? t("userContext.defaultBadge")
                              : t("userContext.setDefault")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={data.profiles.length <= 1}
                            onClick={() => deleteProfile(selectedProfile.id)}
                            title={t("userContext.deleteProfile")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <SettingsSection
                      title={t("userContext.profilesListeningSection")}
                      description={t("userContext.profilesListeningSectionHint")}
                    >
                      <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
                        <ProfileToggleRow
                          id="profile-active-listening"
                          icon={<Ear className="h-4 w-4" />}
                          title={t("userContext.activeListeningLabel")}
                          description={t("userContext.activeListeningHint")}
                          checked={selectedProfile.activeListening ?? false}
                          onCheckedChange={(checked) =>
                            updateProfile(selectedProfile.id, {
                              activeListening: checked,
                              autoSuggestResponses:
                                checked &&
                                selectedProfile.autoSuggestResponses === undefined
                                  ? true
                                  : selectedProfile.autoSuggestResponses,
                            })
                          }
                        />

                        {selectedProfile.activeListening && (
                          <ProfileToggleRow
                            id="profile-auto-suggest"
                            icon={<Sparkles className="h-4 w-4" />}
                            title={t("userContext.autoSuggestLabel")}
                            description={t("userContext.autoSuggestHint")}
                            checked={
                              selectedProfile.autoSuggestResponses !== false
                            }
                            onCheckedChange={(checked) =>
                              updateProfile(selectedProfile.id, {
                                autoSuggestResponses: checked,
                              })
                            }
                            nested
                          />
                        )}
                      </div>
                    </SettingsSection>

                    <SettingsSection
                      title={t("userContext.profilesBehaviorSection")}
                      description={t("userContext.behaviorHint")}
                    >
                      <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <Textarea
                          id="profile-behavior"
                          value={selectedProfile.behaviorPrompt}
                          onChange={(e) =>
                            updateProfile(selectedProfile.id, {
                              behaviorPrompt: e.target.value,
                            })
                          }
                          placeholder={t("userContext.behaviorPlaceholder")}
                          className="min-h-[240px] resize-none border-0 bg-transparent px-4 py-3.5 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </SettingsSection>
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <footer className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">{t("userContext.footerHint")}</p>
          <Button onClick={onClose}>{t("userContext.done")}</Button>
        </footer>
      </div>
    </ModalShell>
  );
}

export default UserContextModal;
