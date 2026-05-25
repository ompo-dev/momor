import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import {
  ToggleLeft,
  ToggleRight,
  Search,
  ArrowRight,
  ArrowLeft,
  MoreHorizontal,
  Globe,
  Clock,
  ChevronRight,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  Ghost,
  Plus,
  Mail,
  Link as LinkIcon,
  ChevronDown,
  Trash2,
  Bell,
  Check,
  Download,
  DownloadCloud,
  CheckCircle,
  AlertCircle,
  User,
  Play,
} from "lucide-react";
import { generateMeetingPDF } from "../utils/pdfGenerator";
import MeetingDetails from "./MeetingDetails";
import TopSearchPill from "./TopSearchPill";
import GlobalChatOverlay from "./GlobalChatOverlay";
import { motion, AnimatePresence } from "framer-motion";
import { FeatureSpotlight } from "./FeatureSpotlight";
import { analytics } from "../lib/analytics/analytics.service"; // Added analytics import
import { useShortcuts } from "../hooks/useShortcuts";
import { useResolvedTheme } from "../hooks/useResolvedTheme";
import { isMac } from "../utils/platformUtils";
import WindowControls from "./WindowControls";
import { UserContextModal } from "./UserContextModal";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Card, CardContent } from "./ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  summary: string;
  detailedSummary?: {
    actionItems: string[];
    keyPoints: string[];
  };
  transcript?: Array<{
    speaker: string;
    text: string;
    timestamp: number;
  }>;
  usage?: Array<{
    type: "assist" | "followup" | "chat" | "followup_questions";
    timestamp: number;
    question?: string;
    answer?: string;
    items?: string[];
  }>;
  active?: boolean; // UI state
  time?: string; // Optional for compatibility
}

interface LauncherProps {
  onStartMeeting: () => void;
  onOpenSettings: (tab?: string) => void;
  onPageChange?: (isMain: boolean) => void;
  ollamaPullStatus?: "idle" | "downloading" | "complete" | "failed";
  ollamaPullPercent?: number;
  ollamaPullMessage?: string;
}

const Launcher: React.FC<LauncherProps> = ({
  onStartMeeting,
  onOpenSettings,
  onPageChange,
  ollamaPullStatus = "idle",
  ollamaPullPercent = 0,
  ollamaPullMessage = "",
}) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith("pt") ? "pt-BR" : "en-US";

  const getGroupLabel = (dateStr: string) => {
    if (dateStr === "Today" || dateStr === t("launcher.today")) {
      return t("launcher.today");
    }

    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const checkDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    if (checkDate.getTime() === today.getTime()) return t("launcher.today");
    if (checkDate.getTime() === yesterday.getTime()) {
      return t("launcher.yesterday");
    }

    return date.toLocaleDateString(dateLocale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const use24h = i18n.language.startsWith("pt");

  const formatTime = (dateStr: string) => {
    if (dateStr === "Today") return t("launcher.justNow");
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(dateLocale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24h,
    });
  };

  const processingTitle = t("overlay.processing");
  const isMeetingProcessing = (title: string) =>
    title === "Processing..." || title === processingTitle;

  const isTodayLabel = (label: string) =>
    label === "Today" || label === t("launcher.today");
  const isYesterdayLabel = (label: string) =>
    label === "Yesterday" || label === t("launcher.yesterday");

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isDetectable, setIsDetectable] = useState(false);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // Global search state (for AI chat overlay)
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [isUserContextOpen, setIsUserContextOpen] = useState(false);
  const [submittedGlobalQuery, setSubmittedGlobalQuery] = useState("");

  const fetchMeetings = () => {
    if (window.electronAPI && window.electronAPI.getRecentMeetings) {
      window.electronAPI
        .getRecentMeetings()
        .then(setMeetings)
        .catch((err) => console.error("Failed to fetch meetings:", err));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    analytics.trackCommandExecuted("refresh_meetings");
    try {
      fetchMeetings();
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    } catch (e) {
      console.error("Refresh failed in handleRefresh:", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Keybinds
  const { isShortcutPressed } = useShortcuts();
  const isLight = useResolvedTheme() === "light";
  useEffect(() => {
    let mounted = true;
    console.log("Launcher mounted");
    // Seed demo data if needed (safe to call always — runs ONCE on mount)
    if (window.electronAPI && window.electronAPI.seedDemo) {
      window.electronAPI
        .seedDemo()
        .catch((err) => console.error("Failed to seed demo:", err));
    }

    // Sync initial undetectable state
    if (window.electronAPI?.getUndetectable) {
      window.electronAPI.getUndetectable().then((undetectable) => {
        if (mounted) setIsDetectable(!undetectable);
      });
    }

    // Listen for undetectable changes
    let removeUndetectableListener: (() => void) | undefined;
    if (window.electronAPI?.onUndetectableChanged) {
      removeUndetectableListener = window.electronAPI.onUndetectableChanged(
        (undetectable) => {
          setIsDetectable(!undetectable);
        },
      );
    }

    fetchMeetings();

    // Sync initial meeting active state — guarded so unmounted component isn't written to
    if (window.electronAPI?.getMeetingActive) {
      window.electronAPI
        .getMeetingActive()
        .then((active) => {
          if (mounted) setIsMeetingActive(active);
        })
        .catch(() => {});
    }

    // Listen for meeting state changes (e.g. meeting started/ended from overlay)
    let removeMeetingStateListener: (() => void) | undefined;
    if (window.electronAPI?.onMeetingStateChanged) {
      removeMeetingStateListener = window.electronAPI.onMeetingStateChanged(
        ({ isActive }) => {
          setIsMeetingActive(isActive);
        },
      );
    }

    // Listen for background updates (e.g. after meeting processing finishes)
    const removeMeetingsListener = window.electronAPI.onMeetingsUpdated(() => {
      console.log("Received meetings-updated event");
      fetchMeetings();
    });

    return () => {
      mounted = false;
      if (removeMeetingsListener) removeMeetingsListener();
      if (removeUndetectableListener) removeUndetectableListener();
      if (removeMeetingStateListener) removeMeetingStateListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount-only: stable setup that must run exactly once

  // Separate effect for keyboard listener — re-registers when isShortcutPressed changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutPressed(e, "toggleVisibility")) {
        e.preventDefault();
        window.electronAPI.toggleWindow();
      } else if (isShortcutPressed(e, "moveWindowUp")) {
        e.preventDefault();
        window.electronAPI.moveWindowUp?.();
      } else if (isShortcutPressed(e, "moveWindowDown")) {
        e.preventDefault();
        window.electronAPI.moveWindowDown?.();
      } else if (isShortcutPressed(e, "moveWindowLeft")) {
        e.preventDefault();
        window.electronAPI.moveWindowLeft?.();
      } else if (isShortcutPressed(e, "moveWindowRight")) {
        e.preventDefault();
        window.electronAPI.moveWindowRight?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isShortcutPressed]);

  if (!window.electronAPI) {
    return (
      <div className="text-white p-10">
        {t('launcher.errorElectronApi')}
      </div>
    );
  }

  const toggleDetectable = () => {
    const newState = !isDetectable;
    setIsDetectable(newState);
    window.electronAPI?.setUndetectable(!newState); // Note: setUndetectable takes the *undetectable* state, which is inverse of *detectable*
    analytics.trackModeSelected(newState ? "launcher" : "undetectable"); // If visible (detectable), mode is normal/launcher. If not detectable, mode is undetectable.
  };

  // Group meetings
  const groupedMeetings = meetings.reduce(
    (acc, meeting) => {
      const label = getGroupLabel(meeting.date);
      if (!acc[label]) acc[label] = [];
      acc[label].push(meeting);
      return acc;
    },
    {} as Record<string, Meeting[]>,
  );

  // Group order (Today, Yesterday, then others sorted new to old is implicit via API return order ideally,
  // but JS object key order isn't guaranteed. We can use a Map or just known keys.)
  // Simple sort for keys:
  const sortedGroups = Object.keys(groupedMeetings).sort((a, b) => {
    if (isTodayLabel(a)) return -1;
    if (isTodayLabel(b)) return 1;
    if (isYesterdayLabel(a)) return -1;
    if (isYesterdayLabel(b)) return 1;
    // Approximation for others: parse date
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const [forwardMeeting, setForwardMeeting] = useState<Meeting | null>(null);

  // Notify parent if we are on the main launcher list view
  useEffect(() => {
    if (onPageChange) {
      onPageChange(!selectedMeeting && !isGlobalChatOpen);
    }
  }, [selectedMeeting, isGlobalChatOpen, onPageChange]);

  const handleOpenMeeting = async (meeting: Meeting) => {
    setForwardMeeting(null); // Clear forward history on new navigation
    console.log("[Launcher] Opening meeting:", meeting.id);
    analytics.trackCommandExecuted("open_meeting_details");

    // Fetch full meeting details including transcript and usage
    if (window.electronAPI && window.electronAPI.getMeetingDetails) {
      try {
        console.log("[Launcher] Fetching full meeting details...");
        const fullMeeting = await window.electronAPI.getMeetingDetails(
          meeting.id,
        );
        console.log("[Launcher] Got meeting details:", fullMeeting);
        console.log(
          "[Launcher] Transcript count:",
          fullMeeting?.transcript?.length,
        );
        console.log("[Launcher] Usage count:", fullMeeting?.usage?.length);
        if (fullMeeting) {
          setSelectedMeeting(fullMeeting);
          return;
        }
      } catch (err) {
        console.error("[Launcher] Failed to fetch meeting details:", err);
      }
    } else {
      console.warn("[Launcher] getMeetingDetails not available on electronAPI");
    }
    // Fallback to list-view data if fetch fails
    setSelectedMeeting(meeting);
  };

  const handleBack = () => {
    setForwardMeeting(selectedMeeting);
    setSelectedMeeting(null);
  };

  const handleForward = () => {
    if (forwardMeeting) {
      setSelectedMeeting(forwardMeeting);
      setForwardMeeting(null);
    }
  };

  // Helper to format duration to mm:ss or mmm:ss
  // Helper to format duration to mm:ss or mmm:ss
  const formatDurationPill = (durationStr: string) => {
    if (!durationStr) return "00:00";

    // Check if it's already in colon format (e.g. "5:30", "105:20")
    if (durationStr.includes(":")) {
      const parts = durationStr.split(":");
      const mins = parts[0];
      const secs = parts[1] || "00";

      // Allow 3 digits for mins if >= 100, otherwise pad to 2
      const formattedMins = mins.length >= 3 ? mins : mins.padStart(2, "0");
      return `${formattedMins}:${secs}`;
    }

    // Fallback for "X min" format (legacy)
    const minutes = parseInt(durationStr.replace("min", "").trim()) || 0;
    const mm = minutes.toString().padStart(2, "0");
    return `${mm}:00`;
  };

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground font-sans overflow-hidden selection:bg-primary/20">
      {/* 1. Header (Static) */}
      <header className="relative w-full h-[40px] shrink-0 flex items-center justify-between pl-0 drag-region select-none bg-card border-b border-border z-[200]">
        {/* Left: Spacing for Traffic Lights + Navigation Arrows */}
        <div className="flex items-center gap-1 no-drag">
          {isMac && <div className="w-[70px]" />}{" "}
          {/* Traffic Light Spacer (macOS only) */}
          {/* Back Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={selectedMeeting ? handleBack : undefined}
            disabled={!selectedMeeting}
            className="mt-1 ml-2 h-8 w-8"
          >
            <ArrowLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleForward}
            disabled={!forwardMeeting}
            className={`mt-1 h-8 w-8 ${!forwardMeeting ? "opacity-0" : ""}`}
          >
            <ArrowRight size={16} />
          </Button>
        </div>

        {/* Center: Spotlight-style Search Pill */}
        <TopSearchPill
          meetings={meetings}
          onAIQuery={(query) => {
            analytics.trackCommandExecuted("ai_query_search");
            setSubmittedGlobalQuery(query);
            setIsGlobalChatOpen(true);
          }}
          onLiteralSearch={(query) => {
            // For now, also use AI query for literal search
            // Could be enhanced to do fuzzy filtering in the UI
            analytics.trackCommandExecuted("literal_search");
            setSubmittedGlobalQuery(query);
            setIsGlobalChatOpen(true);
          }}
          onOpenMeeting={(meetingId) => {
            const meeting = meetings.find((m) => m.id === meetingId);
            if (meeting) {
              handleOpenMeeting(meeting);
              analytics.trackCommandExecuted("open_meeting_from_search");
            }
          }}
        />

        {/* Right: Actions */}
        <div
          className={`flex items-center gap-1 no-drag shrink-0 ${isMac ? "mr-1" : ""}`}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsUserContextOpen(true)}
            title={t("userContext.openTitle")}
            className="h-8 w-8"
          >
            <User size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenSettings()}
            title={t("settings.title")}
            className="h-8 w-8"
          >
            <Settings size={18} />
          </Button>
          {!isMac && <WindowControls />}
        </div>
      </header>

      <div className="relative flex-1 flex flex-col overflow-hidden">
        {!isDetectable && (
          <div
            className={`absolute inset-1 border-2 border-dashed rounded-2xl pointer-events-none z-[100] ${isLight ? "border-black/15" : "border-white/20"}`}
          />
        )}
        <AnimatePresence mode="wait">
          {selectedMeeting ? (
            <motion.div
              key="details"
              className="flex-1 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MeetingDetails
                meeting={selectedMeeting}
                onBack={handleBack}
                onOpenSettings={onOpenSettings}
              />
            </motion.div>
          ) : (
            <motion.div
              key="launcher"
              className="flex-1 flex flex-col overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Main Area - Fixed Top, Scrollable Bottom */}
              {/* Top Section is now effectively static due to parent flex col */}

              {/* TOP SECTION: Grey Background (Scrolls with content) */}
              <section
                className={`${isLight ? "bg-bg-primary" : "bg-bg-elevated"} px-8 pt-6 pb-8 border-b border-border-subtle shrink-0`}
              >
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* 1.5. Hero Header (Title + Controls + CTA) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h1 className="text-3xl font-celeb-light font-medium text-text-primary tracking-wide drop-shadow-sm">
                        {t('launcher.title')}
                      </h1>

                      {/* Refresh Button */}
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={`p-2 text-text-secondary hover:text-text-primary rounded-full transition-colors ${isRefreshing ? "animate-spin text-blue-400" : ""} ${isLight ? "hover:bg-black/8" : "hover:bg-white/10"}`}
                        title={t('launcher.refreshTitle')}
                      >
                        <RefreshCw size={18} />
                      </button>

                      <div className="flex items-center gap-2 border border-border rounded-full px-3 py-1.5 min-w-[140px] bg-muted/50">
                        {isDetectable ? (
                          <Ghost size={14} className="text-muted-foreground" />
                        ) : (
                          <Ghost size={14} className="text-primary" />
                        )}
                        <span className="text-xs font-medium flex-1 text-muted-foreground">
                          {isDetectable ? t('launcher.detectable') : t('launcher.undetectable')}
                        </span>
                        <Switch
                          checked={!isDetectable}
                          onCheckedChange={() => toggleDetectable()}
                          aria-label={t('launcher.undetectable')}
                        />
                      </div>
                    </div>

                    {/* Center: Ollama Pull Status Pill (flex-1 to center evenly) */}
                    <div className="flex-1 flex justify-center mx-4">
                      <AnimatePresence>
                        {ollamaPullStatus !== "idle" && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 25,
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl ${isLight ? "bg-bg-elevated border border-border-muted shadow-[0_4px_16px_rgba(0,0,0,0.1)]" : "bg-bg-elevated/80 border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"}`}
                          >
                            {ollamaPullStatus === "downloading" ? (
                              <DownloadCloud
                                size={14}
                                className="text-blue-400 animate-pulse shrink-0"
                              />
                            ) : ollamaPullStatus === "complete" ? (
                              <CheckCircle
                                size={14}
                                className="text-emerald-400 shrink-0"
                              />
                            ) : (
                              <AlertCircle
                                size={14}
                                className="text-red-400 shrink-0"
                              />
                            )}
                            <div className="flex flex-col">
                              <span className="text-[11px] font-medium text-text-secondary whitespace-nowrap">
                                {ollamaPullStatus === "downloading"
                                  ? t('launcher.settingUpMemory', { percent: ollamaPullPercent })
                                  : ollamaPullMessage}
                              </span>
                              {ollamaPullStatus === "downloading" && (
                                <div className="w-full h-[3px] bg-white/10 rounded-full mt-1 overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                    style={{ width: `${ollamaPullPercent}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <Button
                      size="lg"
                      variant={isMeetingActive ? "outline" : "default"}
                      onClick={() => {
                        if (isMeetingActive) {
                          window.electronAPI?.setWindowMode?.("overlay", true);
                          analytics.trackCommandExecuted(
                            "resume_meeting_from_launcher",
                          );
                        } else {
                          onStartMeeting();
                          analytics.trackCommandExecuted("start_momor_cta");
                        }
                      }}
                      className={`shrink-0 gap-2 h-10 px-5 text-sm font-medium shadow-sm ${
                        isMeetingActive
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          : ""
                      }`}
                    >
                      {isMeetingActive ? (
                        <>
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          {t("launcher.meetingOngoing")}
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 fill-current" aria-hidden />
                          {t("launcher.startMomor")}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* 2. Hero Section Cards */}
                  <div className="w-full h-[198px]">
                    {/* Default Intro — momor support & upcoming features.
                                            Calendar "Up Next" lives in Settings → Calendar, not here. */}
                    <div className="md:col-span-2 h-full">
                      <FeatureSpotlight />
                    </div>
                  </div>
                </div>
              </section>

              {/* BOTTOM SECTION: Black Background (Scrollable content) */}
              <main className="flex-1 overflow-y-auto custom-scrollbar bg-background">
                <section className="px-8 py-8 min-h-full">
                  <div className="max-w-4xl mx-auto space-y-8">
                    {/* Iterating Date Groups */}
                    {sortedGroups.map((label) => (
                      <section key={label}>
                        <h3 className="text-[13px] font-medium text-text-secondary mb-3 pl-1">
                          {label}
                        </h3>
                        <div className="space-y-1">
                          {groupedMeetings[label].map((m) => (
                            <Card
                              key={m.id}
                              className="group relative border-transparent shadow-none bg-transparent hover:bg-accent/50 transition-colors cursor-pointer"
                              onClick={() => handleOpenMeeting(m)}
                            >
                            <CardContent className="flex items-center justify-between px-3 py-2 p-0">
                              <div
                                className={`font-medium text-[14px] max-w-[60%] truncate ${isMeetingProcessing(m.title) ? "text-blue-400 italic animate-pulse" : "text-text-primary"}`}
                              >
                                {isMeetingProcessing(m.title)
                                  ? processingTitle
                                  : m.title}
                              </div>

                              {/* Time & Duration Section */}
                              <div className="flex items-center gap-4">
                                {isMeetingProcessing(m.title) ? (
                                  <div className="flex items-center gap-2 transition-all duration-200 ease-out group-hover:opacity-0 group-hover:translate-x-2 delayed-hover-exit">
                                    <RefreshCw
                                      size={12}
                                      className="animate-spin text-blue-500"
                                    />
                                    <span className="text-xs text-blue-500 font-medium">
                                      {t('launcher.finalizing')}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <span className="relative z-10 bg-bg-elevated text-text-secondary text-[9px] px-1.5 py-0.5 rounded-full font-medium min-w-[35px] text-center tracking-wide">
                                      {formatDurationPill(m.duration)}
                                    </span>

                                    {/* Time Text (Should fade out on hover) */}
                                    <span className="text-[13px] text-text-secondary font-medium min-w-[60px] text-right transition-all duration-200 ease-out group-hover:opacity-0 group-hover:translate-x-2 delayed-hover-exit">
                                      {formatTime(m.date)}
                                    </span>
                                  </>
                                )}
                              </div>

                              <div
                                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 translate-x-4 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal size={16} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        analytics.trackPdfExported();
                                        if (window.electronAPI?.getMeetingDetails) {
                                          try {
                                            const fullMeeting =
                                              await window.electronAPI.getMeetingDetails(m.id);
                                            generateMeetingPDF(fullMeeting || m);
                                          } catch {
                                            generateMeetingPDF(m);
                                          }
                                        } else {
                                          generateMeetingPDF(m);
                                        }
                                      }}
                                    >
                                      <Download size={13} className="mr-2" />
                                      {t("launcher.export")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={async () => {
                                        if (window.electronAPI?.deleteMeeting) {
                                          const success =
                                            await window.electronAPI.deleteMeeting(m.id);
                                          if (success) {
                                            setMeetings((prev) =>
                                              prev.filter((meeting) => meeting.id !== m.id),
                                            );
                                          }
                                        }
                                      }}
                                    >
                                      <Trash2 size={13} className="mr-2" />
                                      {t("launcher.delete")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </CardContent>
                            </Card>
                          ))}
                        </div>
                      </section>
                    ))}

                    {meetings.length === 0 && (
                      <div className="p-4 text-muted-foreground text-sm">
                        {t('launcher.noRecentMeetings')}
                      </div>
                    )}
                  </div>
                </section>
              </main>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notification Toast - Liquid Glass (macOS 26 Tahoe Concept) */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ x: 300, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 300, opacity: 0, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 30,
              mass: 1,
            }}
            className={`fixed bottom-10 right-10 z-[2000] flex items-center gap-4 pl-4 pr-6 py-3.5 rounded-[18px] backdrop-blur-xl saturate-[180%] ring-1 ring-black/10 ${isLight ? "bg-bg-elevated/90 border border-border-muted shadow-[0_8px_32px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.9)]" : "bg-[#2A2A2E]/40 border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(255,255,255,0.05)]"}`}
          >
            {/* Liquid Icon Orb */}
            <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-b from-blue-400/20 to-blue-600/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] border border-white/5">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md" />
              <RefreshCw
                size={15}
                className="text-blue-300 animate-[spin_2s_linear_infinite] drop-shadow-[0_0_5px_rgba(59,130,246,0.6)]"
              />
            </div>

            {/* Text Content */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-text-primary leading-none tracking-tight">
                {t("launcher.refreshed")}
              </span>
              <span className="text-[11px] text-text-tertiary font-medium leading-none tracking-wide">
                {t("launcher.refreshDone")}
              </span>
            </div>

            {/* Specular Highlight Overlay */}
            <div className="absolute inset-0 rounded-[18px] bg-gradient-to-tr from-white/5 via-transparent to-transparent pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Chat Overlay */}
      <GlobalChatOverlay
        isOpen={isGlobalChatOpen}
        onClose={() => {
          setIsGlobalChatOpen(false);
          setSubmittedGlobalQuery("");
        }}
        initialQuery={submittedGlobalQuery}
      />

      <UserContextModal
        isOpen={isUserContextOpen}
        onClose={() => setIsUserContextOpen(false)}
      />
    </div>
  );
};

export default Launcher;
