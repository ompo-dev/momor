import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import packageJson from "../../package.json";
import {
  X,
  Mic,
  Speaker,
  Monitor,
  Keyboard,
  User,
  LifeBuoy,
  LogOut,
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Camera,
  RotateCcw,
  Eye,
  Layout,
  MessageSquare,
  Crop,
  ChevronDown,
  ChevronUp,
  Check,
  BadgeCheck,
  Power,
  Palette,
  Calendar,
  Ghost,
  Sun,
  Moon,
  RefreshCw,
  Info,
  Globe,
  FlaskConical,
  Terminal,
  Settings,
  Activity,
  ExternalLink,
  Trash2,
  Sparkles,
  Pencil,
  Briefcase,
  Building2,
  Search,
  MapPin,
  CheckCircle,
  HelpCircle,
  Zap,
  SlidersHorizontal,
  PointerOff,
  Star,
  AlertCircle,
  Gift,
  Smartphone,
  Cpu,
  Shield,
} from "lucide-react";
import { analytics } from "../lib/analytics/analytics.service";
import { AboutSection } from "./AboutSection";
import { HelpSettings } from "./settings/HelpSettings";
import { GeneralSettingsTab } from "./settings/GeneralSettingsTab";
import { IntegrationsSettings } from "./settings/IntegrationsSettings";
import { normalizeSettingsTab } from "./settings/settingsTabs";
import { SettingsPage } from "./settings/layout/SettingsPage";
import { PhoneMirrorSettings } from "./settings/PhoneMirrorSettings";
import LanguageSettings from "./settings/LanguageSettings";
import { MomorLogoMark } from "./MomorLogoMark";
import { motion, AnimatePresence } from "framer-motion";
import { useShortcuts } from "../hooks/useShortcuts";
import { useResolvedTheme } from "../hooks/useResolvedTheme";
import {
  clampOverlayOpacity,
  getOverlayAppearance,
  OVERLAY_OPACITY_DEFAULT,
  OVERLAY_OPACITY_MIN,
  getDefaultOverlayOpacity,
} from "../lib/overlayAppearance";
import {
  getMeetingInterfaceTheme,
  setMeetingInterfaceTheme,
  type MeetingInterfaceTheme,
} from "../lib/meetingInterfaceTheme";
import { KeyRecorder } from "./ui/KeyRecorder";
import { PremiumUpgradeModal } from "../premium";
import icon from "./icon.png";
import { SettingsNav, type SettingsTabId } from "./shell/SettingsNav";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Card, CardContent } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { SettingsToggleRow } from "./ui/settings-toggle-row";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./ui/dialog";

// ---------------------------------------------------------------------------
// StarRating — renders filled/empty stars for culture ratings

// ---------------------------------------------------------------------------
// MockupMomorInterface — fake in-meeting widget for the opacity preview
// ---------------------------------------------------------------------------
const MockupmomorInterface = ({ opacity }: { opacity: number }) => {
  const resolvedTheme = useResolvedTheme();
  const appearance = useMemo(
    () => getOverlayAppearance(opacity, resolvedTheme),
    [opacity, resolvedTheme],
  );

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none bg-transparent">
      {/* MomorInterface Widget — opacity controlled by the slider */}
      <div
        id="mockup-momor-interface"
        className="flex flex-col items-center pointer-events-none -mt-56"
      >
        {/* TopPill Replica */}
        <div className="flex justify-center mb-2 select-none z-50">
          <div
            className="flex items-center gap-2 rounded-full overlay-pill-surface backdrop-blur-md pl-1.5 pr-1.5 py-1.5"
            style={appearance.pillStyle}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden overlay-icon-surface"
              style={appearance.iconStyle}
            >
              <img
                src={icon}
                alt="Momor"
                className="w-[24px] h-[24px] object-contain opacity-95 scale-105 force-black-icon"
                draggable="false"
              />
            </div>
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-medium border overlay-chip-surface overlay-text-interactive"
              style={appearance.chipStyle}
            >
              <ChevronUp className="w-3.5 h-3.5 opacity-70" />
              <span className="opacity-80 tracking-wide">Hide</span>
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center overlay-icon-surface overlay-text-primary"
              style={appearance.iconStyle}
            >
              <div className="w-3.5 h-3.5 rounded-[3px] bg-red-400 opacity-80" />
            </div>
          </div>
        </div>

        {/* Main Interface Window Replica */}
        <div
          className="relative w-[600px] max-w-full overlay-shell-surface overlay-text-primary backdrop-blur-2xl border rounded-[24px] overflow-hidden flex flex-col pt-2 pb-3"
          style={appearance.shellStyle}
        >
          {/* Rolling Transcript Bar */}
          <div
            className="w-full flex justify-center py-2 px-4 border-b mb-1 overlay-transcript-surface"
            style={appearance.transcriptStyle}
          >
            <p className="text-[13px] truncate max-w-[90%] font-medium overlay-text-primary">
              <span
                className={`${resolvedTheme === "light" ? "text-blue-700" : "text-blue-400"} mr-2 font-semibold`}
              >
                Interviewer
              </span>
              <span className="opacity-95">
                So how would you optimize the current algorithm?
              </span>
            </p>
          </div>

          {/* Chat History Mock */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-3 text-[14px] leading-relaxed font-normal overlay-text-primary">
                <span className="font-semibold text-emerald-500 block mb-1">
                  Suggestion
                </span>
                A good approach would be to use a hash map to cache the
                intermediate results, which brings the time complexity down from
                O(n²) to O(n).
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-nowrap justify-center items-center gap-1.5 px-4 pb-3 pt-3">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 overlay-chip-surface overlay-text-interactive"
              style={appearance.chipStyle}
            >
              <Pencil className="w-3 h-3 opacity-70" /> What to answer?
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 overlay-chip-surface overlay-text-interactive"
              style={appearance.chipStyle}
            >
              <MessageSquare className="w-3 h-3 opacity-70" /> Clarify
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 overlay-chip-surface overlay-text-interactive"
              style={appearance.chipStyle}
            >
              <RefreshCw className="w-3 h-3 opacity-70" /> Recap
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 overlay-chip-surface overlay-text-interactive"
              style={appearance.chipStyle}
            >
              <HelpCircle className="w-3 h-3 opacity-70" /> Follow Up Question
            </div>
            <div
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium min-w-[74px] shrink-0 border overlay-chip-surface overlay-text-interactive"
              style={appearance.chipStyle}
            >
              <Zap className="w-3 h-3 opacity-70" /> Answer
            </div>
          </div>

          {/* Input Area */}
          <div className="px-3">
            <div className="relative group">
              <div
                className="w-full border rounded-xl pl-3 pr-10 py-2.5 h-[38px] flex items-center overlay-input-surface"
                style={appearance.inputStyle}
              >
                <span className="text-[13px] overlay-text-muted">
                  Ask anything on screen or conversation
                </span>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="flex items-center justify-between mt-3 px-0.5">
              <div className="flex items-center gap-1.5">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-medium w-[140px] overlay-control-surface overlay-text-interactive"
                  style={appearance.controlStyle}
                >
                  <span className="truncate min-w-0 flex-1">
                    Gemini 3 Flash
                  </span>
                  <ChevronDown size={14} className="shrink-0" />
                </div>
                <div
                  className="w-px h-3 mx-1"
                  style={appearance.dividerStyle}
                />
                <div
                  className="w-7 h-7 flex items-center justify-center rounded-lg overlay-icon-surface overlay-text-muted"
                  style={appearance.iconStyle}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CustomSelectProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: MediaDeviceInfo[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  icon,
  value,
  options,
  onChange,
  placeholder = "Select device",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((o) => o.deviceId === value)?.label || placeholder;

  return (
    <div
      className="bg-bg-card rounded-xl p-4 border border-border-subtle"
      ref={containerRef}
    >
      {label && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-text-secondary">{icon}</span>
          <label className="text-xs font-medium text-text-primary uppercase tracking-wide">
            {label}
          </label>
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary flex items-center justify-between hover:bg-bg-elevated transition-colors"
        >
          <span className="truncate pr-4">{selectedLabel}</span>
          <ChevronDown
            size={14}
            className={`text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animated fadeIn">
            <div className="p-1 space-y-0.5">
              {options.map((device) => (
                <button
                  key={device.deviceId}
                  onClick={() => {
                    onChange(device.deviceId);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between group transition-colors ${value === device.deviceId ? "bg-bg-input hover:bg-bg-elevated text-text-primary" : "text-text-secondary hover:bg-bg-input hover:text-text-primary"}`}
                >
                  <span className="truncate">
                    {device.label || `Device ${device.deviceId.slice(0, 5)}...`}
                  </span>
                  {value === device.deviceId && (
                    <Check size={14} className="text-accent-primary" />
                  )}
                </button>
              ))}
              {options.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500 italic">
                  No devices found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ProviderOption {
  id: string;
  label: string;
  badge?: string | null;
  recommended?: boolean;
  desc: string;
  color: string;
  icon: React.ReactNode;
}

interface ProviderSelectProps {
  value: string;
  options: ProviderOption[];
  onChange: (value: string) => void;
}

const ProviderSelect: React.FC<ProviderSelectProps> = ({
  value,
  options,
  onChange,
}) => {
  const isLight = useResolvedTheme() === "light";
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.id === value);

  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "orange":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "purple":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "teal":
        return "bg-teal-500/10 text-teal-500 border-teal-500/20";
      case "cyan":
        return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
      case "indigo":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "green":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getIconStyle = (color?: string, isSelectedItem: boolean = false) => {
    if (isSelectedItem) return "bg-accent-primary text-white shadow-sm";
    // For unselected items in list or trigger
    switch (color) {
      case "blue":
        return "bg-blue-500/10 text-blue-600";
      case "orange":
        return "bg-orange-500/10 text-orange-600";
      case "purple":
        return "bg-purple-500/10 text-purple-600";
      case "teal":
        return "bg-teal-500/10 text-teal-600";
      case "cyan":
        return "bg-cyan-500/10 text-cyan-600";
      case "indigo":
        return "bg-indigo-500/10 text-indigo-600";
      case "green":
        return "bg-green-500/10 text-green-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  return (
    <div ref={containerRef} className="relative z-20 font-sans">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full group bg-bg-input border border-border-subtle hover:border-border-muted shadow-sm rounded-xl p-2.5 pr-3.5 flex items-center justify-between transition-all duration-200 outline-none focus:ring-2 focus:ring-accent-primary/20 ${isOpen ? "ring-2 ring-accent-primary/20 border-accent-primary/50" : "hover:shadow-md"}`}
      >
        {selected ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-300 ${getIconStyle(selected.color)}`}
            >
              {selected.icon}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-text-primary truncate leading-tight">
                  {selected.label}
                </span>
                {selected.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ml-2 ${getBadgeStyle(selected.badge === "Saved" ? "green" : selected.color)}`}
                  >
                    {selected.badge}
                  </span>
                )}
                {selected.recommended && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ml-2 ${getBadgeStyle(selected.color)}`}
                  >
                    Recommended
                  </span>
                )}
              </div>
              {/* Short description for trigger */}
              <span className="text-[11px] text-text-tertiary truncate block leading-tight mt-0.5">
                {selected.desc}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-text-secondary px-2 text-sm">
            Select Provider
          </span>
        )}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary transition-transform duration-300 group-hover:bg-bg-input ${isOpen ? "rotate-180 bg-bg-input text-text-primary" : ""}`}
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute top-full left-0 w-full mt-2 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 ${isLight ? "bg-bg-elevated border border-border-subtle" : "bg-bg-elevated/90 border border-white/5"}`}
          >
            <div className="max-h-[320px] overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
              {options.map((option) => {
                const isSelected = value === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                    }}
                    className={`w-full rounded-[10px] p-2 flex items-center gap-3 transition-all duration-200 group relative ${isSelected ? (isLight ? "bg-bg-item-active shadow-inner" : "bg-white/10 shadow-inner") : isLight ? "hover:bg-bg-item-surface" : "hover:bg-white/5"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${isSelected ? "scale-100" : "scale-95 group-hover:scale-100"} ${getIconStyle(option.color, false)}`}
                    >
                      {option.icon}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[13px] font-medium transition-colors ${isSelected && !isLight ? "text-white" : "text-text-primary"}`}
                          >
                            {option.label}
                          </span>
                          {option.badge && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${getBadgeStyle(option.badge === "Saved" ? "green" : option.color)}`}
                            >
                              {option.badge}
                            </span>
                          )}
                          {option.recommended && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${getBadgeStyle(option.color)}`}
                            >
                              Recommended
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <Check
                              size={14}
                              className="text-accent-primary"
                              strokeWidth={3}
                            />
                          </motion.div>
                        )}
                      </div>
                      <span
                        className={`text-[11px] block truncate transition-colors ${isSelected && !isLight ? "text-white/70" : "text-text-tertiary"}`}
                      >
                        {option.desc}
                      </span>
                    </div>
                    {/* Hover Indicator */}
                    {!isSelected && (
                      <div className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-transparent group-hover:ring-border-subtle pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  isOpen,
  onClose,
  initialTab = "general",
}) => {
  const { t } = useTranslation();
  const isLight = useResolvedTheme() === "light";
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() =>
    normalizeSettingsTab(initialTab),
  );

  // Sync active tab when modal opens
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(normalizeSettingsTab(initialTab));
    }
  }, [isOpen, initialTab]);

  const { shortcuts, updateShortcut, resetShortcuts } = useShortcuts();
  const [isUndetectable, setIsUndetectable] = useState(false);
  const [isMousePassthrough, setIsMousePassthrough] = useState(false);
  const [disguiseMode, setDisguiseMode] = useState<
    "terminal" | "settings" | "activity" | "none"
  >("none");
  const [openOnLogin, setOpenOnLogin] = useState(false);
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">(
    "system",
  );
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [isAiLangDropdownOpen, setIsAiLangDropdownOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "checking" | "available" | "uptodate" | "error"
  >("idle");
  const themeDropdownRef = React.useRef<HTMLDivElement>(null);
  const aiLangDropdownRef = React.useRef<HTMLDivElement>(null);
  const [meetingInterfaceTheme, setMeetingInterfaceThemeState] =
    useState<MeetingInterfaceTheme>(getMeetingInterfaceTheme);
  const [isInterfaceThemeDropdownOpen, setIsInterfaceThemeDropdownOpen] =
    useState(false);
  const interfaceThemeDropdownRef = React.useRef<HTMLDivElement>(null);

  const [verboseLogging, setVerboseLogging] = useState(false);
  const [meetingRetention, setMeetingRetention] = useState<
    "forever" | "7d" | "30d" | "never"
  >("forever");
  const [providerDataScopes, setProviderDataScopes] = useState<{
    transcript?: boolean;
    screenshots?: boolean;
    reference_files?: boolean;
    profile_history?: boolean;
    embeddings?: boolean;
    post_call_summary?: boolean;
  }>({});
  const [screenUnderstandingMode, setScreenUnderstandingMode] = useState<
    "vision_first" | "vision_only" | "private_vision"
  >("vision_first");
  const [technicalInterviewVisionFirst, setTechnicalInterviewVisionFirst] =
    useState<boolean>(true);
  const [showVerboseToast, setShowVerboseToast] = useState(false);
  const verboseToastTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Close dropdown when clicking outside
  // Sync with global state changes
  useEffect(() => {
    if (isOpen) {
      // Fetch true initial state from main process
      window.electronAPI
        ?.getUndetectable?.()
        .then(setIsUndetectable)
        .catch(() => {});
      window.electronAPI
        ?.getOverlayMousePassthrough?.()
        .then(setIsMousePassthrough)
        .catch(() => {});
      window.electronAPI
        ?.getDisguise?.()
        .then(setDisguiseMode)
        .catch(() => {});
      window.electronAPI
        ?.getVerboseLogging?.()
        .then(setVerboseLogging)
        .catch(() => {});
      window.electronAPI
        ?.getMeetingRetention?.()
        .then(setMeetingRetention)
        .catch(() => {});
      window.electronAPI
        ?.getProviderDataScopes?.()
        .then(setProviderDataScopes)
        .catch(() => {});
      window.electronAPI
        ?.getScreenUnderstandingMode?.()
        .then(setScreenUnderstandingMode as any)
        .catch(() => {});
      (window.electronAPI as any)
        ?.getTechnicalInterviewVisionFirst?.()
        .then(setTechnicalInterviewVisionFirst)
        .catch(() => {
          // Fallback to deprecated alias if the renderer is talking to an older main process.
          window.electronAPI
            ?.getTechnicalInterviewDirectVision?.()
            .then(setTechnicalInterviewVisionFirst)
            .catch(() => {});
        });
    }
  }, [isOpen]);

  useEffect(() => {
    const api: any = window.electronAPI;
    if (!api?.onScreenUnderstandingModeChanged) return;
    const unsubscribe = api.onScreenUnderstandingModeChanged(
      setScreenUnderstandingMode,
    );
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const api: any = window.electronAPI;
    const handler = (enabled: boolean) =>
      setTechnicalInterviewVisionFirst(enabled);
    const unsub1 = api?.onTechnicalInterviewVisionFirstChanged?.(handler);
    const unsub2 = api?.onTechnicalInterviewDirectVisionChanged?.(handler);
    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, []);

  useEffect(() => {
    if (!showVerboseToast) return;
    verboseToastTimerRef.current = setTimeout(
      () => setShowVerboseToast(false),
      5200,
    );
    return () => {
      if (verboseToastTimerRef.current)
        clearTimeout(verboseToastTimerRef.current);
    };
  }, [showVerboseToast]);

  useEffect(() => {
    if (window.electronAPI?.onUndetectableChanged) {
      const unsubscribe = window.electronAPI.onUndetectableChanged(
        (newState: boolean) => {
          setIsUndetectable(newState);
        },
      );
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onMeetingRetentionChanged) {
      const unsubscribe =
        window.electronAPI.onMeetingRetentionChanged(setMeetingRetention);
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onProviderDataScopesChanged) {
      const unsubscribe = window.electronAPI.onProviderDataScopesChanged(
        setProviderDataScopes,
      );
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onDisguiseChanged) {
      const unsubscribe = window.electronAPI.onDisguiseChanged(
        (newMode: any) => {
          setDisguiseMode(newMode);
        },
      );
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onOverlayMousePassthroughChanged) {
      const unsubscribe = window.electronAPI.onOverlayMousePassthroughChanged(
        (enabled: boolean) => {
          setIsMousePassthrough(enabled);
        },
      );
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onSttLanguageAutoDetected) {
      const unsubscribe = window.electronAPI.onSttLanguageAutoDetected(
        (bcp47: string) => {
          setAutoDetectedLanguage(bcp47);
        },
      );
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        themeDropdownRef.current &&
        !themeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsThemeDropdownOpen(false);
      }
      if (
        aiLangDropdownRef.current &&
        !aiLangDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAiLangDropdownOpen(false);
      }
      if (
        interfaceThemeDropdownRef.current &&
        !interfaceThemeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsInterfaceThemeDropdownOpen(false);
      }
    };

    if (
      isThemeDropdownOpen ||
      isAiLangDropdownOpen ||
      isInterfaceThemeDropdownOpen
    ) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isThemeDropdownOpen, isAiLangDropdownOpen, isInterfaceThemeDropdownOpen]);

  const [showTranscript, setShowTranscript] = useState(() => {
    const stored = localStorage.getItem("momor_interviewer_transcript");
    return stored !== "false";
  });

  const [autoScroll, setAutoScroll] = useState(() => {
    const stored = localStorage.getItem("momor_auto_scroll");
    return stored === "true";
  });

  // Recognition Language
  const [recognitionLanguage, setRecognitionLanguage] = useState("");
  const [selectedSttGroup, setSelectedSttGroup] = useState("");
  const [availableLanguages, setAvailableLanguages] = useState<
    Record<string, any>
  >({});
  const [autoDetectedLanguage, setAutoDetectedLanguage] = useState<
    string | null
  >(null);

  // AI Response Language
  const [aiResponseLanguage, setAiResponseLanguage] = useState("English");
  const [availableAiLanguages, setAvailableAiLanguages] = useState<any[]>([]);

  // Overlay Opacity state
  const [overlayOpacity, setOverlayOpacity] = useState<number>(() => {
    const stored = localStorage.getItem("momor_overlay_opacity");
    const parsed = stored ? parseFloat(stored) : NaN;
    // Treat missing value or the old default (0.65) as "not user-set"
    const isUserSet =
      Number.isFinite(parsed) && parsed !== OVERLAY_OPACITY_DEFAULT;
    return isUserSet ? clampOverlayOpacity(parsed) : getDefaultOverlayOpacity();
  });

  // When the theme changes and the user hasn't saved a custom value, reset to theme-aware default
  const resolvedTheme = useResolvedTheme();
  useEffect(() => {
    const stored = localStorage.getItem("momor_overlay_opacity");
    const parsed = stored ? parseFloat(stored) : NaN;
    const isUserSet =
      Number.isFinite(parsed) && parsed !== OVERLAY_OPACITY_DEFAULT;
    if (!isUserSet) {
      setOverlayOpacity(getDefaultOverlayOpacity());
    }
  }, [resolvedTheme]);

  // Live preview state — true while the user is holding down the slider
  const [isPreviewingOpacity, setIsPreviewingOpacity] = useState(false);
  const [previewOverlayOpacity, setPreviewOverlayOpacity] =
    useState(overlayOpacity);

  // Ref to hold the latest opacity value without triggering renders during drag
  const latestOpacityRef = React.useRef(overlayOpacity);

  const handleOpacityChange = (val: number) => {
    // DOM-direct updates for 0-lag 60fps drag (bypasses React reconciliation)
    const percentText = `${Math.round(val * 100)}%`;
    document
      .querySelectorAll(".opacity-percent-label")
      .forEach((el) => (el.textContent = percentText));
    setPreviewOverlayOpacity(val);
    latestOpacityRef.current = val;

    // Broadcast IPC in real-time so actual meeting overlay tracks slider instantly
    // (safe to do at 60fps, does not trigger React renders)
    window.electronAPI?.setOverlayOpacity?.(val);
  };

  // Bug fix #3: keep latestOpacityRef in sync when overlayOpacity changes outside of a drag
  // (e.g. on first mount, or if another part of code updates it)
  useEffect(() => {
    latestOpacityRef.current = overlayOpacity;
    setPreviewOverlayOpacity(overlayOpacity);
  }, [overlayOpacity]);

  // Bug fix #3 (close-during-drag): if the overlay closes while the user is still dragging,
  // restore all DOM state so nothing is left in a broken state.
  useEffect(() => {
    if (!isOpen && isPreviewingOpacity) {
      stopPreviewingOpacity();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPreviewingOpacity = () => {
    // Bug fix #5: guard against rapid repeated calls (double pointerDown / touch events)
    if (isPreviewingOpacity) return;

    // Direct DOM mutation for sub-millisecond instant hide (bypassing slow React tree diffs)
    document.body.classList.add("disable-transitions");

    const backdrop = document.getElementById("settings-backdrop");
    const wrapper = document.getElementById("settings-panel-wrapper");
    const panel = document.getElementById("settings-panel");
    const card = document.getElementById("opacity-slider-card");
    const mockup = document.getElementById("settings-mockup-wrapper");
    const launcher = document.getElementById("launcher-container");

    if (backdrop) {
      backdrop.style.backgroundColor = "transparent";
      backdrop.style.backdropFilter = "none";
      backdrop.style.transition = "none";
    }
    if (wrapper) {
      wrapper.style.backgroundColor = "transparent";
      wrapper.style.border = "none";
      wrapper.style.boxShadow = "none";
    }
    if (panel) {
      panel.style.visibility = "hidden";
    }
    if (launcher) {
      launcher.style.visibility = "hidden";
    }

    if (card) {
      card.style.visibility = "visible";
      card.style.position = "relative";
      card.style.zIndex = "9999";
    }
    if (mockup) {
      mockup.style.opacity = "1";
    }

    setPreviewOverlayOpacity(latestOpacityRef.current);
    setIsPreviewingOpacity(true);
  };

  const stopPreviewingOpacity = () => {
    // Direct DOM restoration
    document.body.classList.remove("disable-transitions");
    const backdrop = document.getElementById("settings-backdrop");
    const wrapper = document.getElementById("settings-panel-wrapper");
    const panel = document.getElementById("settings-panel");
    const card = document.getElementById("opacity-slider-card");
    const mockup = document.getElementById("settings-mockup-wrapper");
    const launcher = document.getElementById("launcher-container");

    if (backdrop) {
      backdrop.style.backgroundColor = "";
      backdrop.style.backdropFilter = "";
      backdrop.style.transition = "";
    }
    if (wrapper) {
      wrapper.style.backgroundColor = "";
      wrapper.style.border = "";
      wrapper.style.boxShadow = "";
    }
    if (panel) {
      panel.style.visibility = "";
    }
    if (launcher) {
      launcher.style.visibility = "";
    }

    if (card) {
      card.style.visibility = "";
      card.style.position = "";
      card.style.zIndex = "";
    }
    if (mockup) {
      // Bug fix #4: restore mockup to hidden (opacity 0) rather than leaving it visible
      mockup.style.opacity = "0";
    }

    setIsPreviewingOpacity(false);
    // Sync final dragged value back to React state (persists to localStorage + IPC via useEffect)
    setOverlayOpacity(latestOpacityRef.current);
    setPreviewOverlayOpacity(latestOpacityRef.current);
  };

  useEffect(() => {
    // Only persist to localStorage here. IPC is handled real-time in handleOpacityChange
    // to avoid a redundant extra call 150ms after every drag ends.
    const timeoutId = setTimeout(() => {
      localStorage.setItem("momor_overlay_opacity", String(overlayOpacity));
    }, 150);
    return () => clearTimeout(timeoutId);
  }, [overlayOpacity]);

  useEffect(() => {
    const loadLanguages = async () => {
      if (window.electronAPI?.getRecognitionLanguages) {
        const langsRaw = await window.electronAPI.getRecognitionLanguages();
        const langs =
          langsRaw && Object.keys(langsRaw).length > 0
            ? langsRaw
            : {
                auto: {
                  label: "Auto Detect",
                  code: "auto",
                  bcp47: "auto",
                  iso639: "auto",
                  group: "Auto",
                },
                "english-us": {
                  label: "United States",
                  code: "english-us",
                  bcp47: "en-US",
                  iso639: "en",
                  group: "English",
                },
              };
        setAvailableLanguages(langs);

        // Load stored preference or auto-detect
        const storedStt = await window.electronAPI.getSttLanguage();
        let currentLangKey = storedStt;

        if (!currentLangKey) {
          const systemLocale = navigator.language;
          // Try to find exact match or primary match
          const match = Object.entries(langs).find(
            ([_, config]: [string, any]) =>
              config.bcp47 === systemLocale ||
              config.iso639 === systemLocale ||
              (config.alternates && config.alternates.includes(systemLocale)),
          );

          currentLangKey = match ? match[0] : "auto";

          // Save the auto-detected default
          if (window.electronAPI?.setRecognitionLanguage) {
            window.electronAPI.setRecognitionLanguage(currentLangKey);
          }
        }

        setRecognitionLanguage(currentLangKey);

        // Initialize Group based on current language
        if (langs[currentLangKey]) {
          setSelectedSttGroup(langs[currentLangKey].group);
        } else {
          setSelectedSttGroup("Auto");
        }
      }

      if (window.electronAPI?.getAiResponseLanguages) {
        const aiLangs = await window.electronAPI.getAiResponseLanguages();
        // Sort: Auto first, English second, then alphabetical
        const sortedAiLangs = [...aiLangs].sort((a, b) => {
          if (a.code === "auto") return -1;
          if (b.code === "auto") return 1;
          if (a.label === "English") return -1;
          if (b.label === "English") return 1;
          return a.label.localeCompare(b.label);
        });
        setAvailableAiLanguages(sortedAiLangs);

        const storedAi = await window.electronAPI.getAiResponseLanguage();
        setAiResponseLanguage(storedAi || "auto");
      }
    };
    loadLanguages();
  }, []);

  const handleLanguageChange = async (key: string) => {
    setRecognitionLanguage(key);
    setAutoDetectedLanguage(null); // always reset — new session may detect a different language
    if (availableLanguages[key]) {
      setSelectedSttGroup(availableLanguages[key].group);
    }
    if (window.electronAPI?.setRecognitionLanguage) {
      await window.electronAPI.setRecognitionLanguage(key);
    }
  };

  const handleGroupChange = (group: string) => {
    setSelectedSttGroup(group);
    // Find default variant for this group (first one)
    const firstVariant = Object.entries(availableLanguages).find(
      ([_, lang]) => lang.group === group,
    );
    if (firstVariant) {
      handleLanguageChange(firstVariant[0]);
    }
  };

  // Helper to get unique groups
  const languageGroups = Array.from(
    new Set(Object.values(availableLanguages).map((l: any) => l.group)),
  ).sort((a, b) => {
    if (a === "Auto") return -1;
    if (b === "Auto") return 1;
    if (a === "English") return -1;
    if (b === "English") return 1;
    return a.localeCompare(b);
  });

  // Helper to get variants for current group
  const currentGroupVariants = Object.entries(availableLanguages)

    .filter(([_, lang]) => lang.group === selectedSttGroup)
    .map(([key, lang]) => ({
      deviceId: key,
      label: lang.label,
      kind: "audioinput" as MediaDeviceKind,
      groupId: "",
      toJSON: () => ({}),
    }));

  const handleAiLanguageChange = async (key: string) => {
    if (!key) return;
    const previous = aiResponseLanguage;
    setAiResponseLanguage(key); // Optimistic update
    try {
      if (window.electronAPI?.setAiResponseLanguage) {
        const result = await window.electronAPI.setAiResponseLanguage(key);
        if (result && !result.success) {
          // Rollback on explicit failure
          setAiResponseLanguage(previous);
          console.error(
            "[Settings] Failed to set AI response language:",
            result.error,
          );
        }
      }
    } catch (err) {
      // Rollback on exception
      setAiResponseLanguage(previous);
      console.error("[Settings] Exception setting AI response language:", err);
    }
  };

  // Sync transcript setting
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("momor_interviewer_transcript");
      setShowTranscript(stored !== "false");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Sync auto-scroll setting
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("momor_auto_scroll");
      setAutoScroll(stored === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      setMeetingInterfaceThemeState(getMeetingInterfaceTheme());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Theme Handlers
  const handleSetTheme = async (mode: "system" | "light" | "dark") => {
    setThemeMode(mode);
    if (window.electronAPI?.setThemeMode) {
      await window.electronAPI.setThemeMode(mode);
    }
  };

  // Audio Settings
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState("");
  const [selectedOutput, setSelectedOutput] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [useExperimentalSck, setUseExperimentalSck] = useState(false);
  // Most-recent device fallback notice. Populated by main process via
  // 'device-selection-applied' IPC when the saved device couldn't be opened
  // and the audio pipeline silently fell back to the system default.
  const [deviceFallbackNotice, setDeviceFallbackNotice] = useState<{
    kind: "input" | "output";
    requested: string | null;
    actual: string | null;
    reason?: string;
  } | null>(null);

  // STT Provider settings
  const [sttProvider, setSttProvider] = useState<
    | "none"
    | "google"
    | "groq"
    | "openai"
    | "deepgram"
    | "elevenlabs"
    | "azure"
    | "ibmwatson"
    | "soniox"
    | "momor"
    | "local-whisper"
  >("none");
  const [groqSttModel, setGroqSttModel] = useState("whisper-large-v3-turbo");
  const [sttGroqKey, setSttGroqKey] = useState("");
  const [sttOpenaiKey, setSttOpenaiKey] = useState("");
  const [sttDeepgramKey, setSttDeepgramKey] = useState("");
  const [sttElevenLabsKey, setSttElevenLabsKey] = useState("");
  const [sttAzureKey, setSttAzureKey] = useState("");
  const [sttAzureRegion, setSttAzureRegion] = useState("eastus");
  const [sttIbmKey, setSttIbmKey] = useState("");
  const [sttOpenaiBaseUrl, setSttOpenaiBaseUrl] = useState("");
  const [sttTestStatus, setSttTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [sttTestError, setSttTestError] = useState("");
  const [sttSaving, setSttSaving] = useState(false);
  const [sttSaved, setSttSaved] = useState(false);
  const [googleServiceAccountPath, setGoogleServiceAccountPath] = useState<
    string | null
  >(null);
  const [hasmomorKey, setHasmomorKey] = useState(false);
  const [hasStoredSttGroqKey, setHasStoredSttGroqKey] = useState(false);
  const [hasStoredSttOpenaiKey, setHasStoredSttOpenaiKey] = useState(false);
  const [hasStoredDeepgramKey, setHasStoredDeepgramKey] = useState(false);
  const [hasStoredElevenLabsKey, setHasStoredElevenLabsKey] = useState(false);
  const [hasStoredAzureKey, setHasStoredAzureKey] = useState(false);
  const [hasStoredIbmWatsonKey, setHasStoredIbmWatsonKey] = useState(false);
  const [sttSonioxKey, setSttSonioxKey] = useState("");
  const [hasStoredSonioxKey, setHasStoredSonioxKey] = useState(false);
  const [isSttDropdownOpen, setIsSttDropdownOpen] = useState(false);
  const sttDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close STT dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sttDropdownRef.current &&
        !sttDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSttDropdownOpen(false);
      }
    };
    if (isSttDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSttDropdownOpen]);

  // Load STT settings on mount
  useEffect(() => {
    const loadSttSettings = async () => {
      try {
        // @ts-ignore
        const creds = await window.electronAPI?.getStoredCredentials?.();
        if (creds) {
          setSttProvider(creds.sttProvider || "none");
          if (creds.groqSttModel) setGroqSttModel(creds.groqSttModel);
          setGoogleServiceAccountPath(creds.googleServiceAccountPath);
          setHasStoredSttGroqKey(creds.hasSttGroqKey);
          setHasStoredSttOpenaiKey(creds.hasSttOpenaiKey);
          setHasStoredDeepgramKey(creds.hasDeepgramKey);
          setHasStoredElevenLabsKey(creds.hasElevenLabsKey);
          setHasStoredAzureKey(creds.hasAzureKey);
          if (creds.azureRegion) setSttAzureRegion(creds.azureRegion);
          setHasStoredIbmWatsonKey(creds.hasIbmWatsonKey);
          setHasStoredSonioxKey(creds.hasSonioxKey || false);

          setHasmomorKey(creds.hasmomorKey || false);
          // Populate key fields so switching providers doesn't make saved keys appear gone
          if (creds.sttGroqKey) setSttGroqKey(creds.sttGroqKey);
          if (creds.sttOpenaiKey) setSttOpenaiKey(creds.sttOpenaiKey);
          if (creds.sttDeepgramKey) setSttDeepgramKey(creds.sttDeepgramKey);
          if (creds.sttElevenLabsKey)
            setSttElevenLabsKey(creds.sttElevenLabsKey);
          if (creds.sttAzureKey) setSttAzureKey(creds.sttAzureKey);
          if (creds.sttIbmKey) setSttIbmKey(creds.sttIbmKey);
          if (creds.sttSonioxKey) setSttSonioxKey(creds.sttSonioxKey);
          if (typeof creds.openAiSttBaseUrl === "string")
            setSttOpenaiBaseUrl(creds.openAiSttBaseUrl);
        }
      } catch (e) {
        console.error("Failed to load STT settings:", e);
      }
    };
    if (isOpen) loadSttSettings();
  }, [isOpen]);

  // PR #173: Live-reload settings whenever the backend broadcasts a credentials change
  // (e.g., when the user saves an STT key in a different window, or main fires it after
  // a provider auto-reconfigure like Momor key clear).
  useEffect(() => {
    if (!window.electronAPI?.onCredentialsChanged) return;
    const unsubscribe = window.electronAPI.onCredentialsChanged(() => {
      if (isOpen) {
        // Re-fetch credentials silently — purely additive, no state reset
        window.electronAPI
          ?.getStoredCredentials?.()
          .then((creds: any) => {
            if (!creds) return;
            setSttProvider(creds.sttProvider || "none");
            if (creds.groqSttModel) setGroqSttModel(creds.groqSttModel);
            setHasmomorKey(creds.hasmomorKey || false);
            setHasStoredSttGroqKey(creds.hasSttGroqKey);
            setHasStoredSttOpenaiKey(creds.hasSttOpenaiKey);
            setHasStoredDeepgramKey(creds.hasDeepgramKey);
            setHasStoredElevenLabsKey(creds.hasElevenLabsKey);
            setHasStoredAzureKey(creds.hasAzureKey);
            setHasStoredIbmWatsonKey(creds.hasIbmWatsonKey);
            setHasStoredSonioxKey(creds.hasSonioxKey || false);
          })
          .catch(() => {
            /* silently ignore */
          });
      }
    });
    return () => unsubscribe();
  }, []); // mount-once: isOpen is checked inside the callback

  const handleSttProviderChange = async (
    provider:
      | "none"
      | "google"
      | "groq"
      | "openai"
      | "deepgram"
      | "elevenlabs"
      | "azure"
      | "ibmwatson"
      | "soniox"
      | "momor"
      | "local-whisper",
  ) => {
    setSttProvider(provider);
    setIsSttDropdownOpen(false);
    setSttTestStatus("idle");
    setSttTestError("");
    try {
      // @ts-ignore
      await window.electronAPI?.setSttProvider?.(provider);
    } catch (e) {
      console.error("Failed to set STT provider:", e);
    }
  };

  const handleSttKeySubmit = async (
    provider:
      | "groq"
      | "openai"
      | "deepgram"
      | "elevenlabs"
      | "azure"
      | "ibmwatson"
      | "soniox",
    key: string,
  ) => {
    if (!key.trim()) return;

    // Auto-test before saving
    setSttSaving(true);
    setSttTestStatus("testing");
    setSttTestError("");

    try {
      // @ts-ignore
      const testResult = await window.electronAPI?.testSttConnection?.(
        provider,
        key.trim(),
        provider === "azure" ? sttAzureRegion : undefined,
      );

      if (!testResult?.success) {
        setSttTestStatus("error");
        setSttTestError(
          testResult?.error || "Validation failed. Key not saved.",
        );
        setSttSaving(false);
        return; // Stop save
      }

      // If success, proceed to save
      setSttTestStatus("success");
      setTimeout(() => setSttTestStatus("idle"), 3000);

      if (provider === "groq") {
        // @ts-ignore
        await window.electronAPI?.setGroqSttApiKey?.(key.trim());
      } else if (provider === "openai") {
        // @ts-ignore
        await window.electronAPI?.setOpenAiSttApiKey?.(key.trim());
      } else if (provider === "elevenlabs") {
        // @ts-ignore
        await window.electronAPI?.setElevenLabsApiKey?.(key.trim());
      } else if (provider === "azure") {
        // @ts-ignore
        await window.electronAPI?.setAzureApiKey?.(key.trim());
      } else if (provider === "ibmwatson") {
        // @ts-ignore
        await window.electronAPI?.setIbmWatsonApiKey?.(key.trim());
      } else if (provider === "soniox") {
        // @ts-ignore
        await window.electronAPI?.setSonioxApiKey?.(key.trim());
      } else {
        // @ts-ignore
        await window.electronAPI?.setDeepgramApiKey?.(key.trim());
      }
      if (provider === "groq") setHasStoredSttGroqKey(true);
      else if (provider === "openai") setHasStoredSttOpenaiKey(true);
      else if (provider === "elevenlabs") setHasStoredElevenLabsKey(true);
      else if (provider === "azure") setHasStoredAzureKey(true);
      else if (provider === "ibmwatson") setHasStoredIbmWatsonKey(true);
      else if (provider === "soniox") setHasStoredSonioxKey(true);
      else setHasStoredDeepgramKey(true);

      setSttSaved(true);
      setTimeout(() => setSttSaved(false), 2000);
    } catch (e: any) {
      console.error(`Failed to save ${provider} STT key:`, e);
      setSttTestStatus("error");
      setSttTestError(e.message || "Validation failed");
    } finally {
      setSttSaving(false);
    }
  };

  const handleRemoveSttKey = async (
    provider:
      | "groq"
      | "openai"
      | "deepgram"
      | "elevenlabs"
      | "azure"
      | "ibmwatson"
      | "soniox",
  ) => {
    if (
      !confirm(
        `Are you sure you want to remove the ${provider === "ibmwatson" ? "IBM Watson" : provider.charAt(0).toUpperCase() + provider.slice(1)} API key?`,
      )
    )
      return;

    try {
      if (provider === "groq") {
        // @ts-ignore
        await window.electronAPI?.setGroqSttApiKey?.("");
        setSttGroqKey("");
        setHasStoredSttGroqKey(false);
      } else if (provider === "openai") {
        // @ts-ignore
        await window.electronAPI?.setOpenAiSttApiKey?.("");
        setSttOpenaiKey("");
        setHasStoredSttOpenaiKey(false);
      } else if (provider === "elevenlabs") {
        // @ts-ignore
        await window.electronAPI?.setElevenLabsApiKey?.("");
        setSttElevenLabsKey("");
        setHasStoredElevenLabsKey(false);
      } else if (provider === "azure") {
        // @ts-ignore
        await window.electronAPI?.setAzureApiKey?.("");
        setSttAzureKey("");
        setHasStoredAzureKey(false);
      } else if (provider === "ibmwatson") {
        // @ts-ignore
        await window.electronAPI?.setIbmWatsonApiKey?.("");
        setSttIbmKey("");
        setHasStoredIbmWatsonKey(false);
      } else if (provider === "soniox") {
        // @ts-ignore
        await window.electronAPI?.setSonioxApiKey?.("");
        setSttSonioxKey("");
        setHasStoredSonioxKey(false);
      } else {
        // @ts-ignore
        await window.electronAPI?.setDeepgramApiKey?.("");
        setSttDeepgramKey("");
        setHasStoredDeepgramKey(false);
      }
    } catch (e) {
      console.error(`Failed to remove ${provider} STT key:`, e);
    }
  };

  const handleRemoveTavilyKey = async () => {
    if (!confirm("Are you sure you want to remove the Tavily API Key?")) return;

    try {
      await window.electronAPI?.setTavilyApiKey?.("");
    } catch (e) {
      console.error("Failed to remove Tavily API key:", e);
    }
  };

  const handleTestSttConnection = async () => {
    if (
      sttProvider === "none" ||
      sttProvider === "google" ||
      sttProvider === "momor" ||
      sttProvider === "local-whisper"
    )
      return;
    const keyMap: Record<string, string> = {
      groq: sttGroqKey,
      openai: sttOpenaiKey,
      deepgram: sttDeepgramKey,
      elevenlabs: sttElevenLabsKey,
      azure: sttAzureKey,
      ibmwatson: sttIbmKey,
      soniox: sttSonioxKey,
    };
    const keyToTest = keyMap[sttProvider] || "";
    if (!keyToTest.trim()) {
      setSttTestStatus("error");
      setSttTestError(t("common.enterApiKeyFirst"));
      return;
    }

    setSttTestStatus("testing");
    setSttTestError("");
    try {
      // @ts-ignore
      const result = await window.electronAPI?.testSttConnection?.(
        sttProvider,
        keyToTest.trim(),
        sttProvider === "azure" ? sttAzureRegion : undefined,
      );
      if (result?.success) {
        setSttTestStatus("success");
        setTimeout(() => setSttTestStatus("idle"), 3000);
      } else {
        setSttTestStatus("error");
        setSttTestError(result?.error || "Connection failed");
      }
    } catch (e: any) {
      setSttTestStatus("error");
      setSttTestError(e.message || "Test failed");
    }
  };

  // Load stored credentials on mount

  const handleCheckForUpdates = async () => {
    if (updateStatus === "checking") return;
    setUpdateStatus("checking");
    try {
      await window.electronAPI.checkForUpdates();
    } catch (error) {
      console.error("Failed to check for updates:", error);
      setUpdateStatus("error");
      setTimeout(() => setUpdateStatus("idle"), 3000);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const unsubs = [
      window.electronAPI.onUpdateChecking(() => {
        setUpdateStatus("checking");
      }),
      window.electronAPI.onUpdateAvailable(() => {
        setUpdateStatus("available");
        // Don't close settings - let user see the button change to "Update Available"
      }),
      window.electronAPI.onUpdateNotAvailable(() => {
        setUpdateStatus("uptodate");
        setTimeout(() => setUpdateStatus("idle"), 3000);
      }),
      window.electronAPI.onUpdateError((err) => {
        console.error("[Settings] Update error:", err);
        setUpdateStatus("error");
        setTimeout(() => setUpdateStatus("idle"), 3000);
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      // Load detectable status
      if (window.electronAPI?.getUndetectable) {
        window.electronAPI.getUndetectable().then(setIsUndetectable);
      }
      if (window.electronAPI?.getOpenAtLogin) {
        window.electronAPI.getOpenAtLogin().then(setOpenOnLogin);
      }
      if (window.electronAPI?.getThemeMode) {
        window.electronAPI
          .getThemeMode()
          .then(({ mode }) => setThemeMode(mode));
      }

      // Load settings
      const loadDevices = async () => {
        try {
          const [inputs, outputs] = await Promise.all([
            // @ts-ignore
            window.electronAPI?.getInputDevices() || Promise.resolve([]),
            // @ts-ignore
            window.electronAPI?.getOutputDevices() || Promise.resolve([]),
          ]);

          // Map to shape compatible with CustomSelect (which expects MediaDeviceInfo-like objects)
          const formatDevices = (
            devs: any[],
            kind: "audioinput" | "audiooutput",
          ) => {
            const normalized = (Array.isArray(devs) ? devs : [])
              .map((d) => ({
                deviceId: d?.id ?? d?.deviceId ?? "default",
                label:
                  d?.name ??
                  d?.label ??
                  (kind === "audioinput"
                    ? "Default Microphone"
                    : "Default Speakers"),
                kind,
                groupId: d?.groupId ?? "",
                toJSON: () => d,
              }))
              .filter(
                (d) => typeof d.deviceId === "string" && d.deviceId.length > 0,
              );

            if (normalized.length === 0) {
              return [
                {
                  deviceId: "default",
                  label:
                    kind === "audioinput"
                      ? "Default Microphone"
                      : "Default Speakers",
                  kind,
                  groupId: "",
                  toJSON: () => ({ id: "default" }),
                },
              ];
            }

            return normalized;
          };

          const formattedInputs = formatDevices(inputs, "audioinput");
          const formattedOutputs = formatDevices(outputs, "audiooutput");
          setInputDevices(formattedInputs);
          setOutputDevices(formattedOutputs);

          // Load saved preferences
          const savedInput = localStorage.getItem("preferredInputDeviceId");
          const savedOutput = localStorage.getItem("preferredOutputDeviceId");
          const inputIds = formattedInputs.map((d) => d.deviceId);
          const outputIds = formattedOutputs.map((d) => d.deviceId);

          if (savedInput && inputIds.includes(savedInput)) {
            setSelectedInput(savedInput);
          } else if (formattedInputs.length > 0 && !selectedInput) {
            setSelectedInput(formattedInputs[0].deviceId);
          }

          if (savedOutput && outputIds.includes(savedOutput)) {
            setSelectedOutput(savedOutput);
          } else if (formattedOutputs.length > 0 && !selectedOutput) {
            setSelectedOutput(formattedOutputs[0].deviceId);
          }
        } catch (e) {
          console.error("Error loading native devices:", e);
        }
      };
      loadDevices();

      // Load Experimental SCK pref
      const savedSck =
        localStorage.getItem("useExperimentalSckBackend") === "true";
      setUseExperimentalSck(savedSck);

    }
  }, [isOpen]); // Reload only when settings opens

  // Listen for device-selection-applied so the user can see when their saved
  // device couldn't be opened and audio fell back to the system default.
  // Pre-fix this was silent: settings showed "AirPods" selected but capture
  // was actually using the built-in mic, leaving users to wonder why their
  // device choice "doesn't work".
  useEffect(() => {
    if (!window.electronAPI?.onDeviceSelectionApplied) return;
    const unsubscribe = window.electronAPI.onDeviceSelectionApplied(
      (payload) => {
        if (payload.fellBack) {
          setDeviceFallbackNotice({
            kind: payload.kind,
            requested: payload.requested,
            actual: payload.actual,
            reason: payload.reason,
          });
        } else {
          // Successful apply for this kind — clear any stale notice that
          // pointed at the same channel.
          setDeviceFallbackNotice((prev) =>
            prev && prev.kind === payload.kind ? null : prev,
          );
        }
      },
    );
    return unsubscribe;
  }, []);

  // Use the native mic test path so device IDs stay consistent with the meeting runtime.
  useEffect(() => {
    if (isOpen && activeTab === "integrations") {
      const unsubscribe = window.electronAPI?.onAudioTestLevel?.((level) => {
        setMicLevel(Math.max(0, Math.min(100, level * 100)));
      });

      window.electronAPI
        ?.startAudioTest(selectedInput || undefined)
        .catch((error) => {
          console.error("Error starting native microphone test:", error);
          setMicLevel(0);
        });

      return () => {
        unsubscribe?.();
        window.electronAPI?.stopAudioTest?.().catch((error) => {
          console.error("Error stopping native microphone test:", error);
        });
        setMicLevel(0);
      };
    } else {
      setMicLevel(0);
      window.electronAPI?.stopAudioTest?.().catch((error) => {
        console.error("Error stopping native microphone test:", error);
      });
    }
  }, [isOpen, activeTab, selectedInput]);

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          id="settings-panel-wrapper"
          className="flex max-w-5xl w-[min(96vw,56rem)] h-[min(85vh,720px)] p-0 gap-0 overflow-hidden border-border bg-background text-foreground [&>button]:hidden sm:rounded-xl"
          onInteractOutside={(e) => {
            if (isPreviewingOpacity) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isPreviewingOpacity) e.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">{t("settings.title")}</DialogTitle>
          <div
            id="settings-panel"
            className="flex w-full h-full min-h-0"
            style={{ visibility: isPreviewingOpacity ? "hidden" : "visible" }}
          >
              <SettingsNav
                activeTab={activeTab}
                onTabChange={(tab) => setActiveTab(tab)}
                onClose={onClose}
              />

              <ScrollArea className="flex-1 bg-background">
              <div className="px-6 py-6 md:px-8 relative min-h-full">
                {activeTab === "general" && (
                  <GeneralSettingsTab
                    isOpen={isOpen}
                    onClose={onClose}
                    onPreviewActiveChange={(active, opacity) => {
                      setIsPreviewingOpacity(active);
                      setPreviewOverlayOpacity(opacity);
                    }}
                  />
                )}

                <div className={activeTab === "integrations" ? undefined : "hidden"}>
                  <IntegrationsSettings isOpen={isOpen} />
                </div>
                {activeTab === "keybinds" && (
                  <SettingsPage
                    title={t("settings.keybinds.title")}
                    description={t("settings.keybinds.desc")}
                    actions={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetShortcuts}
                        className="gap-2"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("settings.keybinds.restoreDefault")}
                      </Button>
                    }
                    className="select-text"
                  >
                    <div className="space-y-5 pb-4">

                    <div className="grid gap-6">
                      {/* General Category */}
                      <div>
                        <h4 className="text-sm font-bold text-text-primary mb-3">
                          General
                        </h4>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between py-1.5 group">
                            <div className="flex items-center gap-3">
                              <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                <Eye size={14} />
                              </span>
                              <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                Toggle Visibility
                              </span>
                            </div>
                            <KeyRecorder
                              currentKeys={shortcuts.toggleVisibility}
                              onSave={(keys) =>
                                updateShortcut("toggleVisibility", keys)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between py-1.5 group">
                            <div className="flex items-center gap-3">
                              <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                <PointerOff size={14} />
                              </span>
                              <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                Toggle Mouse Passthrough
                              </span>
                            </div>
                            <KeyRecorder
                              currentKeys={shortcuts.toggleMousePassthrough}
                              onSave={(keys) =>
                                updateShortcut("toggleMousePassthrough", keys)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between py-1.5 group">
                            <div className="flex items-center gap-3">
                              <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                <MessageSquare size={14} />
                              </span>
                              <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                Process Screenshots
                              </span>
                            </div>
                            <KeyRecorder
                              currentKeys={shortcuts.processScreenshots}
                              onSave={(keys) =>
                                updateShortcut("processScreenshots", keys)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between py-1.5 group">
                            <div className="flex items-center gap-3">
                              <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                <Sparkles size={14} />
                              </span>
                              <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                Capture Screen & Ask AI
                              </span>
                            </div>
                            <KeyRecorder
                              currentKeys={shortcuts.captureAndProcess}
                              onSave={(keys) =>
                                updateShortcut("captureAndProcess", keys)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between py-1.5 group">
                            <div className="flex items-center gap-3">
                              <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                <RotateCcw size={14} />
                              </span>
                              <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                Reset / Cancel
                              </span>
                            </div>
                            <KeyRecorder
                              currentKeys={shortcuts.resetCancel}
                              onSave={(keys) =>
                                updateShortcut("resetCancel", keys)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between py-1.5 group">
                            <div className="flex items-center gap-3">
                              <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                <Camera size={14} />
                              </span>
                              <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                Take Screenshot
                              </span>
                            </div>
                            <KeyRecorder
                              currentKeys={shortcuts.takeScreenshot}
                              onSave={(keys) =>
                                updateShortcut("takeScreenshot", keys)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between py-1.5 group">
                            <div className="flex items-center gap-3">
                              <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                <Crop size={14} />
                              </span>
                              <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                Selective Screenshot
                              </span>
                            </div>
                            <KeyRecorder
                              currentKeys={shortcuts.selectiveScreenshot}
                              onSave={(keys) =>
                                updateShortcut("selectiveScreenshot", keys)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Chat Category */}
                      <div>
                        <div className="mb-3">
                          <h4 className="text-sm font-bold text-text-primary">
                            Chat
                          </h4>
                        </div>
                        <div className="space-y-1">
                          {[
                            {
                              id: "whatToAnswer",
                              label: "What to Answer",
                              icon: <Sparkles size={14} />,
                            },
                            {
                              id: "clarify",
                              label: "Clarify",
                              icon: <MessageSquare size={14} />,
                            },
                            {
                              id: "followUp",
                              label: "Follow Up",
                              icon: <MessageSquare size={14} />,
                            },
                            {
                              id: "dynamicAction4",
                              label: "Recap / Brainstorm",
                              icon: <RefreshCw size={14} />,
                            },
                            {
                              id: "answer",
                              label: "Answer / Record",
                              icon: <Mic size={14} />,
                            },
                            {
                              id: "codeHint",
                              label: "Get Code Hint",
                              icon: <Zap size={14} />,
                            },
                            {
                              id: "brainstorm",
                              label: "Brainstorm Approaches",
                              icon: <Zap size={14} />,
                            },
                            {
                              id: "scrollUp",
                              label: "Scroll Up",
                              icon: <ArrowUp size={14} />,
                            },
                            {
                              id: "scrollDown",
                              label: "Scroll Down",
                              icon: <ArrowDown size={14} />,
                            },
                            {
                              id: "scrollLeft",
                              label: "Scroll Left (code block)",
                              icon: <ArrowLeft size={14} />,
                            },
                            {
                              id: "scrollRight",
                              label: "Scroll Right (code block)",
                              icon: <ArrowRight size={14} />,
                            },
                            {
                              id: "focusInput",
                              label: "Toggle Stealth Typing",
                              icon: <MessageSquare size={14} />,
                            },
                          ].map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between py-1.5 group"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                  {item.icon}
                                </span>
                                <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                  {item.label}
                                </span>
                              </div>
                              <KeyRecorder
                                currentKeys={
                                  shortcuts[item.id as keyof typeof shortcuts]
                                }
                                onSave={(keys) =>
                                  updateShortcut(item.id as any, keys)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Window Category */}
                      <div>
                        <h4 className="text-sm font-bold text-text-primary mb-3">
                          Window
                        </h4>
                        <div className="space-y-1">
                          {[
                            {
                              id: "moveWindowUp",
                              label: "Move Window Up",
                              icon: <ArrowUp size={14} />,
                            },
                            {
                              id: "moveWindowDown",
                              label: "Move Window Down",
                              icon: <ArrowDown size={14} />,
                            },
                            {
                              id: "moveWindowLeft",
                              label: "Move Window Left",
                              icon: <ArrowLeft size={14} />,
                            },
                            {
                              id: "moveWindowRight",
                              label: "Move Window Right",
                              icon: <ArrowRight size={14} />,
                            },
                          ].map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between py-1.5 group"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">
                                  {item.icon}
                                </span>
                                <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">
                                  {item.label}
                                </span>
                              </div>
                              <KeyRecorder
                                currentKeys={
                                  shortcuts[item.id as keyof typeof shortcuts]
                                }
                                onSave={(keys) =>
                                  updateShortcut(item.id as any, keys)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  </SettingsPage>
                )}

                {activeTab === "phone-mirror" && <PhoneMirrorSettings />}

                {activeTab === "language" && <LanguageSettings />}

                {activeTab === "help" && (
                  <HelpSettings
                    onNavigate={(tab) =>
                      setActiveTab(normalizeSettingsTab(tab))
                    }
                  />
                )}

                {activeTab === "about" && <AboutSection />}
              </div>
              </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Live Preview — mockup sits below the dialog */}
      <div
        id="settings-mockup-wrapper"
        className="fixed inset-0 z-[49] pointer-events-none transition-opacity duration-150"
        style={{ opacity: isPreviewingOpacity ? 1 : 0 }}
      >
        <MockupmomorInterface opacity={previewOverlayOpacity} />
      </div>
    </>
  );
};

export default SettingsOverlay;
