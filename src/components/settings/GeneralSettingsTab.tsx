import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import packageJson from "../../../package.json";
import {
  Ghost,
  PointerOff,
  Power,
  Shield,
  Terminal,
  Layout,
  MessageSquare,
  ArrowDown,
  Palette,
  Monitor,
  Sun,
  Moon,
  Globe,
  BadgeCheck,
  RefreshCw,
  Check,
  X,
  Eye,
  Settings,
  Activity,
} from "lucide-react";
import { analytics } from "../../lib/analytics/analytics.service";
import {
  clampOverlayOpacity,
  OVERLAY_OPACITY_DEFAULT,
  OVERLAY_OPACITY_MIN,
  getDefaultOverlayOpacity,
} from "../../lib/overlayAppearance";
import { useResolvedTheme } from "../../hooks/useResolvedTheme";
import { SettingsToggleRow } from "../ui/settings-toggle-row";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Slider } from "../ui/slider";
import { Card } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SettingsPage } from "./layout/SettingsPage";
import { SettingsSection } from "./layout/SettingsSection";
import { SettingsList } from "./layout/SettingsList";
import { SettingsListRow } from "./layout/SettingsListRow";
import { cn } from "@/lib/utils";

function getDialogOverlay(): HTMLElement | null {
  return document.querySelector("[data-radix-dialog-overlay]");
}

export interface GeneralSettingsTabProps {
  isOpen: boolean;
  onClose: () => void;
  onPreviewActiveChange: (active: boolean, opacity: number) => void;
}

export function GeneralSettingsTab({
  isOpen,
  onClose,
  onPreviewActiveChange,
}: GeneralSettingsTabProps) {
  const { t } = useTranslation();
  const resolvedTheme = useResolvedTheme();

  const [isUndetectable, setIsUndetectable] = useState(false);
  const [isMousePassthrough, setIsMousePassthrough] = useState(false);
  const [openOnLogin, setOpenOnLogin] = useState(false);
  const [meetingRetention, setMeetingRetention] = useState<
    "forever" | "7d" | "30d" | "never"
  >("forever");
  const [providerDataScopes, setProviderDataScopes] = useState<
    Record<string, boolean | undefined>
  >({});
  const [disguiseMode, setDisguiseMode] = useState<
    "terminal" | "settings" | "activity" | "none"
  >("none");
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">(
    "system",
  );
  const [aiResponseLanguage, setAiResponseLanguage] = useState("auto");
  const [availableAiLanguages, setAvailableAiLanguages] = useState<
    { code: string; label: string }[]
  >([]);
  const [showTranscript, setShowTranscript] = useState(
    () => localStorage.getItem("momor_interviewer_transcript") !== "false",
  );
  const [autoScroll, setAutoScroll] = useState(
    () => localStorage.getItem("momor_auto_scroll") === "true",
  );
  const [verboseLogging, setVerboseLogging] = useState(false);
  const [showVerboseToast, setShowVerboseToast] = useState(false);
  const [screenUnderstandingMode, setScreenUnderstandingMode] = useState<
    "vision_first" | "vision_only" | "private_vision"
  >("vision_first");
  const [technicalInterviewVisionFirst, setTechnicalInterviewVisionFirst] =
    useState(true);
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "checking" | "available" | "uptodate" | "error"
  >("idle");

  const [overlayOpacity, setOverlayOpacity] = useState<number>(() => {
    const stored = localStorage.getItem("momor_overlay_opacity");
    const parsed = stored ? parseFloat(stored) : NaN;
    const isUserSet =
      Number.isFinite(parsed) && parsed !== OVERLAY_OPACITY_DEFAULT;
    return isUserSet ? clampOverlayOpacity(parsed) : getDefaultOverlayOpacity();
  });
  const [isPreviewingOpacity, setIsPreviewingOpacity] = useState(false);
  const latestOpacityRef = useRef(overlayOpacity);

  useEffect(() => {
    const stored = localStorage.getItem("momor_overlay_opacity");
    const parsed = stored ? parseFloat(stored) : NaN;
    const isUserSet =
      Number.isFinite(parsed) && parsed !== OVERLAY_OPACITY_DEFAULT;
    if (!isUserSet) setOverlayOpacity(getDefaultOverlayOpacity());
  }, [resolvedTheme]);

  useEffect(() => {
    latestOpacityRef.current = overlayOpacity;
    onPreviewActiveChange(isPreviewingOpacity, overlayOpacity);
  }, [overlayOpacity, isPreviewingOpacity, onPreviewActiveChange]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem("momor_overlay_opacity", String(overlayOpacity));
    }, 150);
    return () => clearTimeout(timeoutId);
  }, [overlayOpacity]);

  useEffect(() => {
    if (!isOpen) return;
    window.electronAPI?.getUndetectable?.().then(setIsUndetectable).catch(() => {});
    window.electronAPI?.getOverlayMousePassthrough?.().then(setIsMousePassthrough).catch(() => {});
    window.electronAPI?.getDisguise?.().then(setDisguiseMode).catch(() => {});
    window.electronAPI?.getOpenAtLogin?.().then(setOpenOnLogin).catch(() => {});
    window.electronAPI?.getMeetingRetention?.().then(setMeetingRetention).catch(() => {});
    window.electronAPI?.getProviderDataScopes?.().then(setProviderDataScopes).catch(() => {});
    window.electronAPI?.getVerboseLogging?.().then(setVerboseLogging).catch(() => {});
    window.electronAPI?.getScreenUnderstandingMode?.().then(setScreenUnderstandingMode as any).catch(() => {});
    window.electronAPI?.getThemeMode?.().then(({ mode }) => setThemeMode(mode)).catch(() => {});
    (window.electronAPI as any)?.getTechnicalInterviewVisionFirst?.()
      .then(setTechnicalInterviewVisionFirst)
      .catch(() => {
        window.electronAPI?.getTechnicalInterviewDirectVision?.()
          .then(setTechnicalInterviewVisionFirst)
          .catch(() => {});
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubs = [
      window.electronAPI.onUpdateChecking(() => setUpdateStatus("checking")),
      window.electronAPI.onUpdateAvailable(() => setUpdateStatus("available")),
      window.electronAPI.onUpdateNotAvailable(() => {
        setUpdateStatus("uptodate");
        setTimeout(() => setUpdateStatus("idle"), 3000);
      }),
      window.electronAPI.onUpdateError(() => {
        setUpdateStatus("error");
        setTimeout(() => setUpdateStatus("idle"), 3000);
      }),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [isOpen]);

  useEffect(() => {
    const loadAiLangs = async () => {
      const aiLangs = await window.electronAPI?.getAiResponseLanguages?.();
      if (!aiLangs) return;
      const sorted = [...aiLangs].sort((a, b) => {
        if (a.code === "auto") return -1;
        if (b.code === "auto") return 1;
        if (a.label === "English") return -1;
        if (b.label === "English") return 1;
        return a.label.localeCompare(b.label);
      });
      setAvailableAiLanguages(sorted);
      const stored = await window.electronAPI?.getAiResponseLanguage?.();
      setAiResponseLanguage(stored || "auto");
    };
    void loadAiLangs();
  }, []);

  const handleOpacityChange = (vals: number[]) => {
    const val = vals[0] ?? overlayOpacity;
    document
      .querySelectorAll(".opacity-percent-label")
      .forEach((el) => (el.textContent = `${Math.round(val * 100)}%`));
    latestOpacityRef.current = val;
    onPreviewActiveChange(true, val);
    window.electronAPI?.setOverlayOpacity?.(val);
  };

  const startPreviewingOpacity = () => {
    if (isPreviewingOpacity) return;
    document.body.classList.add("disable-transitions");
    const backdrop = getDialogOverlay();
    const wrapper = document.getElementById("settings-panel-wrapper");
    const panel = document.getElementById("settings-panel");
    const card = document.getElementById("opacity-slider-card");
    const mockup = document.getElementById("settings-mockup-wrapper");
    const launcher = document.getElementById("launcher-container");

    if (backdrop) {
      backdrop.style.backgroundColor = "transparent";
      backdrop.style.backdropFilter = "none";
    }
    if (wrapper) {
      wrapper.style.backgroundColor = "transparent";
      wrapper.style.border = "none";
      wrapper.style.boxShadow = "none";
    }
    if (panel) panel.style.visibility = "hidden";
    if (launcher) launcher.style.visibility = "hidden";
    if (card) {
      card.style.visibility = "visible";
      card.style.position = "relative";
      card.style.zIndex = "9999";
    }
    if (mockup) mockup.style.opacity = "1";

    setIsPreviewingOpacity(true);
    onPreviewActiveChange(true, latestOpacityRef.current);
  };

  const stopPreviewingOpacity = () => {
    document.body.classList.remove("disable-transitions");
    const backdrop = getDialogOverlay();
    const wrapper = document.getElementById("settings-panel-wrapper");
    const panel = document.getElementById("settings-panel");
    const card = document.getElementById("opacity-slider-card");
    const mockup = document.getElementById("settings-mockup-wrapper");
    const launcher = document.getElementById("launcher-container");

    if (backdrop) {
      backdrop.style.backgroundColor = "";
      backdrop.style.backdropFilter = "";
    }
    if (wrapper) {
      wrapper.style.backgroundColor = "";
      wrapper.style.border = "";
      wrapper.style.boxShadow = "";
    }
    if (panel) panel.style.visibility = "";
    if (launcher) launcher.style.visibility = "";
    if (card) {
      card.style.visibility = "";
      card.style.position = "";
      card.style.zIndex = "";
    }
    if (mockup) mockup.style.opacity = "0";

    setIsPreviewingOpacity(false);
    setOverlayOpacity(latestOpacityRef.current);
    onPreviewActiveChange(false, latestOpacityRef.current);
  };

  useEffect(() => {
    if (!isOpen && isPreviewingOpacity) stopPreviewingOpacity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSetTheme = async (mode: "system" | "light" | "dark") => {
    setThemeMode(mode);
    await window.electronAPI?.setThemeMode?.(mode);
  };

  const handleAiLanguageChange = async (key: string) => {
    const previous = aiResponseLanguage;
    setAiResponseLanguage(key);
    try {
      const result = await window.electronAPI?.setAiResponseLanguage?.(key);
      if (result && !result.success) setAiResponseLanguage(previous);
    } catch {
      setAiResponseLanguage(previous);
    }
  };

  const handleCheckForUpdates = async () => {
    if (updateStatus === "checking") return;
    setUpdateStatus("checking");
    try {
      await window.electronAPI.checkForUpdates();
    } catch {
      setUpdateStatus("error");
      setTimeout(() => setUpdateStatus("idle"), 3000);
    }
  };

  const scopeItems = [
    { key: "transcript", label: t("settings.general.scopes.transcript") },
    { key: "screenshots", label: t("settings.general.scopes.screenshots") },
    { key: "reference_files", label: t("settings.general.scopes.referenceFiles") },
    { key: "profile_history", label: t("settings.general.scopes.profileHistory") },
    { key: "embeddings", label: t("settings.general.scopes.embeddings") },
    { key: "post_call_summary", label: t("settings.general.scopes.postCallSummary") },
  ] as const;

  const disguiseOptions = [
    { id: "none" as const, labelKey: "none", icon: Layout },
    { id: "terminal" as const, labelKey: "terminal", icon: Terminal },
    { id: "settings" as const, labelKey: "settings", icon: Settings },
    { id: "activity" as const, labelKey: "activity", icon: Activity },
  ] as const;

  return (
    <SettingsPage
      title={t("settings.sidebar.general")}
      description={t("settings.general.sectionDesc")}
    >
      <SettingsSection>
        <SettingsToggleRow
          icon={<Ghost size={18} />}
          title={
            isUndetectable
              ? t("settings.general.undetectable")
              : t("settings.general.detectable")
          }
          description={t("settings.general.screenSharing", {
            mode: isUndetectable
              ? t("settings.general.undetectable")
              : t("settings.general.detectable"),
          })}
          checked={isUndetectable}
          highlighted={isUndetectable}
          onCheckedChange={(v) => {
            setIsUndetectable(v);
            window.electronAPI?.setUndetectable(v);
            analytics.trackModeSelected(v ? "undetectable" : "overlay");
          }}
        />
        <SettingsToggleRow
          icon={<PointerOff size={18} />}
          title={t("settings.general.mousePassthrough")}
          description={t("settings.general.mousePassthroughDesc")}
          checked={isMousePassthrough}
          onCheckedChange={(v) => {
            setIsMousePassthrough(v);
            window.electronAPI?.setOverlayMousePassthrough(v);
          }}
        />
      </SettingsSection>

      <SettingsSection title={t("settings.general.sectionTitle")}>
        <SettingsList>
          <SettingsListRow
            icon={<Power size={18} />}
            title={t("settings.general.openOnLogin")}
            description={t("settings.general.openOnLoginDesc")}
            control={
              <Switch
                checked={openOnLogin}
                onCheckedChange={(v) => {
                  setOpenOnLogin(v);
                  window.electronAPI?.setOpenAtLogin(v);
                }}
              />
            }
          />
          <SettingsListRow
            icon={<Shield size={18} />}
            title={t("settings.general.retention")}
            description={t("settings.general.retentionDesc")}
            control={
              <Switch
                checked={meetingRetention === "never"}
                onCheckedChange={(v) => {
                  const next = v ? "never" : "forever";
                  setMeetingRetention(next);
                  window.electronAPI?.setMeetingRetention?.(next);
                }}
              />
            }
          />
          <SettingsListRow
            icon={<MessageSquare size={18} />}
            title={t("settings.general.transcript")}
            description={t("settings.general.transcriptDesc")}
            control={
              <Switch
                checked={showTranscript}
                onCheckedChange={(v) => {
                  setShowTranscript(v);
                  localStorage.setItem("momor_interviewer_transcript", String(v));
                  window.dispatchEvent(new Event("storage"));
                }}
              />
            }
          />
          <SettingsListRow
            icon={<ArrowDown size={18} />}
            title={t("settings.general.autoScroll")}
            description={t("settings.general.autoScrollDesc")}
            control={
              <Switch
                checked={autoScroll}
                onCheckedChange={(v) => {
                  setAutoScroll(v);
                  localStorage.setItem("momor_auto_scroll", String(v));
                  window.dispatchEvent(new Event("storage"));
                }}
              />
            }
          />
          <SettingsListRow
            icon={<Palette size={18} />}
            title={t("settings.general.theme")}
            description={t("settings.general.themeDesc")}
            control={
              <Select value={themeMode} onValueChange={(v) => handleSetTheme(v as any)}>
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">
                    <span className="flex items-center gap-2">
                      <Monitor className="h-3.5 w-3.5" /> System
                    </span>
                  </SelectItem>
                  <SelectItem value="light">
                    <span className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5" /> Light
                    </span>
                  </SelectItem>
                  <SelectItem value="dark">
                    <span className="flex items-center gap-2">
                      <Moon className="h-3.5 w-3.5" /> Dark
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingsListRow
            icon={<Globe size={18} />}
            title={t("settings.general.aiLanguage")}
            description={t("settings.general.aiLanguageDesc")}
            control={
              <Select value={aiResponseLanguage} onValueChange={handleAiLanguageChange}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableAiLanguages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.code === "auto" ? "Auto" : lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <SettingsListRow
            icon={<BadgeCheck size={18} />}
            title={t("settings.general.checkForUpdates")}
            description={t("settings.general.versionText", {
              version: packageJson.version,
            })}
            control={
              <Button
                size="sm"
                variant={
                  updateStatus === "available" ? "default" : "secondary"
                }
                disabled={updateStatus === "checking"}
                onClick={async () => {
                  if (updateStatus === "available") {
                    await window.electronAPI.downloadUpdate();
                    onClose();
                  } else {
                    void handleCheckForUpdates();
                  }
                }}
              >
                {updateStatus === "checking" ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {t("settings.general.checking")}
                  </>
                ) : updateStatus === "available" ? (
                  t("settings.general.updateAvailable")
                ) : updateStatus === "uptodate" ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    {t("settings.general.upToDate")}
                  </>
                ) : updateStatus === "error" ? (
                  t("common.error")
                ) : (
                  t("settings.general.checkForUpdatesBtn")
                )}
              </Button>
            }
          />
        </SettingsList>
      </SettingsSection>

      <SettingsSection
        title={t("settings.general.cloudScopesTitle")}
        description={t("settings.general.cloudScopesDesc")}
      >
        <SettingsList>
          {scopeItems.map(({ key, label }) => {
            const allowed = providerDataScopes[key] !== false;
            return (
              <SettingsListRow
                key={key}
                title={label}
                control={
                  <Switch
                    checked={allowed}
                    onCheckedChange={() => {
                      const next = { ...providerDataScopes, [key]: !allowed };
                      setProviderDataScopes(next);
                      window.electronAPI?.setProviderDataScopes?.(next);
                    }}
                  />
                }
              />
            );
          })}
        </SettingsList>
      </SettingsSection>

      <SettingsSection
        title={t("settings.general.screenUnderstandingTitle")}
        description={t("settings.general.screenUnderstandingDesc")}
      >
        <div className="grid gap-2">
          {(
            [
              { value: "vision_first", label: t("settings.general.visionFirst"), desc: t("settings.general.visionFirstDesc") },
              { value: "vision_only", label: t("settings.general.visionOnly"), desc: t("settings.general.visionOnlyDesc") },
              { value: "private_vision", label: t("settings.general.privateVision"), desc: t("settings.general.privateVisionDesc") },
            ] as const
          ).map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setScreenUnderstandingMode(value);
                window.electronAPI?.setScreenUnderstandingMode?.(value);
              }}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                screenUnderstandingMode === value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <p className="text-sm font-medium">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
            </button>
          ))}
        </div>
        <SettingsList className="mt-3">
          <SettingsListRow
            title={t("settings.general.technicalInterviewVision")}
            description={t("settings.general.technicalInterviewVisionDesc")}
            control={
              <Switch
                checked={technicalInterviewVisionFirst}
                onCheckedChange={(v) => {
                  setTechnicalInterviewVisionFirst(v);
                  const api = window.electronAPI as any;
                  if (api?.setTechnicalInterviewVisionFirst) {
                    api.setTechnicalInterviewVisionFirst(v);
                  } else {
                    window.electronAPI?.setTechnicalInterviewDirectVision?.(v);
                  }
                }}
              />
            }
          />
          <SettingsListRow
            icon={<Terminal size={18} />}
            title={t("settings.general.verboseLogging")}
            description={t("settings.general.verboseLoggingDesc")}
            control={
              <Switch
                checked={verboseLogging}
                onCheckedChange={(v) => {
                  setVerboseLogging(v);
                  window.electronAPI?.setVerboseLogging?.(v);
                  if (v) setShowVerboseToast(true);
                }}
              />
            }
          />
        </SettingsList>
        <AnimatePresence>
          {showVerboseToast && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="mt-2 border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90">
                Logs → ~/Documents/momor_debug.log
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </SettingsSection>

      <Card
        id="opacity-slider-card"
        className="p-5"
        style={
          isPreviewingOpacity
            ? { visibility: "visible", position: "relative", zIndex: 9999 }
            : undefined
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4 text-muted-foreground" />
            {t("settings.general.overlayOpacity")}
          </div>
          <span className="opacity-percent-label text-sm font-semibold tabular-nums">
            {Math.round(overlayOpacity * 100)}%
          </span>
        </div>
        <Slider
          min={OVERLAY_OPACITY_MIN}
          max={1}
          step={0.01}
          value={[isPreviewingOpacity ? latestOpacityRef.current : overlayOpacity]}
          onValueChange={handleOpacityChange}
          onPointerDown={startPreviewingOpacity}
          onPointerUp={stopPreviewingOpacity}
          onPointerCancel={stopPreviewingOpacity}
        />
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{t("settings.general.moreStealth")}</span>
          <span>{t("settings.general.fullyVisible")}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("settings.general.opacityDesc")}{" "}
          <span className="text-foreground/80">
            {t("settings.general.opacityPreview")}
          </span>
        </p>
      </Card>

      <SettingsSection
        title={t("settings.general.disguise")}
        description={t("settings.general.disguiseDesc")}
      >
        {isUndetectable && (
          <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
            {t("settings.general.disguiseUndetectableHint")}
          </p>
        )}
        <div
          className={cn(
            "grid grid-cols-2 gap-2",
            isUndetectable && "pointer-events-none opacity-50",
          )}
        >
          {disguiseOptions.map(({ id, labelKey, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              variant={disguiseMode === id ? "default" : "outline"}
              className="h-auto justify-start gap-2 px-3 py-2.5"
              disabled={isUndetectable}
              onClick={() => {
                setDisguiseMode(id);
                window.electronAPI?.setDisguise(id);
                analytics.trackModeSelected(`disguise_${id}`);
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium">
                {t(`settings.general.disguiseOptions.${labelKey}`)}
              </span>
            </Button>
          ))}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
