import React, { useState, useEffect, useCallback } from "react"; // forcing refresh
import { useTranslation } from 'react-i18next';
import { AppProviders } from "./components/shell";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import MomorInterface from "./components/MomorInterface";
import SettingsPopup from "./components/SettingsPopup"; // Keeping for legacy/specific window support if needed
import Launcher from "./components/Launcher";
import ModelSelectorWindow from "./components/ModelSelectorWindow";
import SettingsOverlay from "./components/SettingsOverlay";
import StartupSequence from "./components/StartupSequence";
import { AnimatePresence, motion } from "framer-motion";
import UpdateBanner from "./components/UpdateBanner";
import { SupportToaster } from "./components/SupportToaster";
import { MomorQuotaBanner } from "./components/MomorQuotaBanner";
import { FreeTrialBanner } from "./components/trial/FreeTrialBanner";
import { FreeTrialModal } from "./components/trial/FreeTrialModal";
import { TrialPromoToaster } from "./components/trial/TrialPromoToaster";
import { PermissionsToaster } from "./components/onboarding/PermissionsToaster";
import { AlertCircle } from "lucide-react";
import {
  clampOverlayOpacity,
  OVERLAY_OPACITY_DEFAULT,
  getDefaultOverlayOpacity,
} from "./lib/overlayAppearance";
import {
  getMeetingInterfaceTheme,
  type MeetingInterfaceTheme,
} from "./lib/meetingInterfaceTheme";
import {
  PremiumPromoToaster,
  RemoteCampaignToaster,
  PremiumUpgradeModal,
  MomorApiPromoToaster,
  MaxUltraUpgradeToaster,
  useAdCampaigns,
} from "./premium";
import { analytics } from "./lib/analytics/analytics.service";
import { ErrorBoundary } from "./components/ErrorBoundary";

const App: React.FC = () => {
  const { t } = useTranslation();
  const isSettingsWindow =
    new URLSearchParams(window.location.search).get("window") === "settings";
  const isLauncherWindow =
    new URLSearchParams(window.location.search).get("window") === "launcher";
  const isOverlayWindow =
    new URLSearchParams(window.location.search).get("window") === "overlay";
  const isModelSelectorWindow =
    new URLSearchParams(window.location.search).get("window") ===
    "model-selector";
  const isCropperWindow =
    new URLSearchParams(window.location.search).get("window") === "cropper";

  // Default to launcher if not specified (dev mode safety)
  const isDefault =
    !isSettingsWindow &&
    !isOverlayWindow &&
    !isModelSelectorWindow &&
    !isCropperWindow;

  if (isCropperWindow) {
    const Cropper = React.lazy(() => import("./components/Cropper"));
    return (
      <React.Suspense
        fallback={<div className="w-screen h-screen bg-transparent" />}
      >
        <Cropper />
      </React.Suspense>
    );
  }

  // Initialize Analytics
  useEffect(() => {
    // Only init if we are in a main window context to avoid duplicate events from helper windows
    // Actually, we probably want to track app open from the main entry point.
    // Let's protect initialization to ensure single run per window.
    // The service handles single-init, but let's be thoughtful about WHICH window tracks "App Open".
    // Launcher is the main entry. Overlay is the "Assistant".

    analytics.initAnalytics();

    if (isLauncherWindow || isDefault) {
      analytics.trackAppOpen();
    }

    if (isOverlayWindow) {
      analytics.trackAssistantStart();
    }

    // Cleanup / Session End
    const handleUnload = () => {
      if (isOverlayWindow) {
        analytics.trackAssistantStop();
      }
      if (isLauncherWindow || isDefault) {
        analytics.trackAppClose();
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [isLauncherWindow, isOverlayWindow, isDefault]);

  // State
  // One-shot first-run startup sequence. Once the user dismisses it (or any
  // future code flips the flag), it never appears again on subsequent launches.
  const [showStartup, setShowStartup] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] =
    useState<string>("general");
  const openSettingsExclusive = useCallback((tab: string = "general") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  }, []);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPremiumActive, setIsPremiumActive] = useState(false);
  const [hasLoadedLicense, setHasLoadedLicense] = useState(false);
  const [planDetails, setPlanDetails] = useState<{
    isPremium: boolean;
    plan?: string;
    provider?: string;
  }>({ isPremium: false });

  // Overlay opacity — only meaningful when isOverlayWindow, but stored centrally
  // so it can be initialized once from localStorage and updated via IPC.
  const [overlayOpacity, setOverlayOpacity] = useState<number>(() => {
    const stored = localStorage.getItem("momor_overlay_opacity");
    const parsed = stored ? parseFloat(stored) : NaN;
    // Treat missing value or the old default (0.65) as "not user-set"
    const isUserSet =
      Number.isFinite(parsed) && parsed !== OVERLAY_OPACITY_DEFAULT;
    return isUserSet ? clampOverlayOpacity(parsed) : getDefaultOverlayOpacity();
  });

  const [meetingInterfaceTheme, setMeetingInterfaceThemeState] =
    useState<MeetingInterfaceTheme>(getMeetingInterfaceTheme);

  const [isLauncherMainView, setIsLauncherMainView] = useState(true);

  // Initialize Ads Campaign Manager
  const [appStartTime] = useState<number>(Date.now());
  const [lastMeetingEndTime, setLastMeetingEndTime] = useState<number | null>(
    null,
  );
  const [isProcessingMeeting, setIsProcessingMeeting] =
    useState<boolean>(false);

  // Ollama Auto-Pull State
  const [ollamaPullStatus, setOllamaPullStatus] = useState<
    "idle" | "downloading" | "complete" | "failed"
  >("idle");
  const [ollamaPullPercent, setOllamaPullPercent] = useState<number>(0);
  const [ollamaPullMessage, setOllamaPullMessage] = useState<string>("");

  // Re-index State
  const [incompatibleWarning, setIncompatibleWarning] = useState<{
    count: number;
    oldProvider: string;
    newProvider: string;
  } | null>(null);

  // API check
  const [hasmomorApi, setHasmomorApi] = useState<boolean>(false);

  // ── Onboarding / promo toasters ───────────────────────────
  const [showPermissionsToaster, setShowPermissionsToaster] = useState(false);
  const [showTrialPromo, setShowTrialPromo] = useState(false);

  // ── Free Trial global state ────────────────────────────────
  const [activeTrial, setActiveTrial] = useState<{
    expiresAt: string;
    usage: { ai: number; stt_seconds: number; search: number };
  } | null>(null);
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);

  const isAppReady =
    !isSettingsWindow &&
    !isOverlayWindow &&
    !isModelSelectorWindow &&
    !showStartup &&
    !isSettingsOpen &&
    isLauncherMainView;
  const { activeAd, dismissAd, previewAd } = useAdCampaigns(
    planDetails,
    false,
    isAppReady,
    appStartTime,
    lastMeetingEndTime,
    isProcessingMeeting,
    hasmomorApi,
  );

  // Preview shortcuts — Ctrl/Cmd+Shift+1-5 force-show any ad card.
  // Uses e.code so Shift doesn't remap the digit to a symbol ('!' etc.).
  useEffect(() => {
    const CODE_MAP: Record<string, string> = {
      Digit1: "max_ultra_upgrade",
      Digit2: "promo",
      Digit3: "momor_api",
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      const ad = CODE_MAP[e.code];
      if (!ad) return;
      e.preventDefault();
      previewAd(ad as any);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewAd]);

  useEffect(() => {
    // Clean up old local storage
    localStorage.removeItem("useLegacyAudioBackend");

    // Load full plan details for targeted ad delivery (plan tier + provider).
    window.electronAPI
      ?.licenseGetDetails?.()
      .then((details) => {
        setPlanDetails(details ?? { isPremium: false });
        setIsPremiumActive(details?.isPremium ?? false);
        setHasLoadedLicense(true);
      })
      .catch(() => {
        // Fallback: async premium check if licenseGetDetails is unavailable
        const premiumCheck =
          window.electronAPI?.licenseCheckPremiumAsync ??
          window.electronAPI?.licenseCheckPremium;
        if (premiumCheck) {
          premiumCheck()
            .then((active: boolean) => {
              setIsPremiumActive(active);
              setPlanDetails({ isPremium: active });
              setHasLoadedLicense(true);
            })
            .catch(() => setHasLoadedLicense(true));
        } else {
          setHasLoadedLicense(true);
        }
      });

    // Also check for momor API key
    window.electronAPI
      ?.getStoredCredentials?.()
      .then((creds) => setHasmomorApi(!!creds?.hasmomorKey))
      .catch(() => {});

    // ── Trial: check stored token and start polling if active ──
    let trialPollId: ReturnType<typeof setInterval> | null = null;
    let profileWiped = false; // guard: only wipe once per session
    const checkTrial = async () => {
      try {
        const res = await window.electronAPI?.getTrialStatus?.();
        if (!res?.ok) return;
        if (res.expired) {
          setActiveTrial(null);
          // Auto-wipe profile data the first time expiry is detected so that
          // resume/JD data doesn't linger in SQLite beyond the trial window.
          if (!profileWiped) {
            profileWiped = true;
            window.electronAPI?.wipeTrialProfileData?.().catch(() => {});
          }
          setShowTrialExpiredModal(true);
          if (trialPollId) {
            clearInterval(trialPollId);
            trialPollId = null;
          }
        } else {
          setActiveTrial({
            expiresAt: res.expires_at ?? "",
            usage: res.usage ?? { ai: 0, stt_seconds: 0, search: 0 },
          });
        }
      } catch {
        /* ignore — non-critical */
      }
    };
    window.electronAPI
      ?.getLocalTrial?.()
      .then((local: any) => {
        if (!local?.hasToken) return;
        if (local.expired) {
          // Already expired at launch — wipe immediately then show modal after a brief delay
          if (!profileWiped) {
            profileWiped = true;
            window.electronAPI?.wipeTrialProfileData?.().catch(() => {});
          }
          setTimeout(() => setShowTrialExpiredModal(true), 10_000);
          return;
        }
        checkTrial();
        trialPollId = setInterval(checkTrial, 30_000);
      })
      .catch(() => {});

    // Listen for trial-ended event (emitted by trial:end-byok IPC)
    const removeTrialListener = window.electronAPI?.onTrialEnded?.(() => {
      setActiveTrial(null);
      setShowTrialExpiredModal(false);
    });

    // ── Onboarding toasters ──────────────────────────────────
    if (isLauncherWindow || isDefault) {
      const permsShown = localStorage.getItem("momor_perms_shown_v1");
      if (!permsShown) {
        // First ever launch — show permissions toaster
        setShowPermissionsToaster(true);
      } else {
        // Subsequent launches — trial promo will self-gate via TrialPromoToaster
        setShowTrialPromo(true);
      }
    }

    // Listen for open-settings-tab events from other windows (e.g. overlay)
    const removeOpenSettingsTab = window.electronAPI?.onOpenSettingsTab?.(
      (tab: string) => {
        openSettingsExclusive(tab);
      },
    );

    // Listen for meeting processing completion to trigger post-meeting ads
    const removeMeetingsListener = window.electronAPI?.onMeetingsUpdated?.(
      () => {
        console.log(
          "[App.tsx] Meetings updated (processing finished), starting ad delay timer",
        );
        setIsProcessingMeeting(false);
        setLastMeetingEndTime(Date.now());
      },
    );

    // Listen for Ollama Auto-Pull Progress
    let removeProgress: (() => void) | undefined;
    let removeComplete: (() => void) | undefined;
    if (
      window.electronAPI?.onOllamaPullProgress &&
      window.electronAPI?.onOllamaPullComplete
    ) {
      removeProgress = window.electronAPI.onOllamaPullProgress((data) => {
        setOllamaPullStatus("downloading");
        setOllamaPullPercent(data.percent || 0);
        setOllamaPullMessage(data.status || "Downloading...");
      });

      removeComplete = window.electronAPI.onOllamaPullComplete(() => {
        setOllamaPullStatus("complete");
        setOllamaPullMessage("Local AI memory ready");
        setOllamaPullPercent(100);
        setTimeout(() => setOllamaPullStatus("idle"), 3000);
      });
    }

    let removeWarning: (() => void) | undefined;
    if (window.electronAPI?.onIncompatibleProviderWarning) {
      removeWarning = window.electronAPI.onIncompatibleProviderWarning(
        (data) => {
          setIncompatibleWarning(data);
        },
      );
    }

    // Listen for real-time license status changes (activation, revocation, deactivation)
    const removeLicenseListener = window.electronAPI?.onLicenseStatusChanged?.(
      (data) => {
        setIsPremiumActive(data.isPremium);
        setPlanDetails((prev) => ({
          ...prev,
          isPremium: data.isPremium,
          ...(data.plan ? { plan: data.plan } : {}),
        }));
        setHasLoadedLicense(true);
      },
    );

    return () => {
      if (removeMeetingsListener) removeMeetingsListener();
      if (removeProgress) removeProgress();
      if (removeComplete) removeComplete();
      if (removeWarning) removeWarning();
      if (removeLicenseListener) removeLicenseListener();
      if (trialPollId) clearInterval(trialPollId);
      if (removeTrialListener) removeTrialListener();
      if (removeOpenSettingsTab) removeOpenSettingsTab();
    };
  }, []);

  // Listen for overlay opacity changes — scoped to overlay window only
  useEffect(() => {
    if (!isOverlayWindow) return;
    const removeOpacityListener = window.electronAPI?.onOverlayOpacityChanged?.(
      (opacity) => {
        setOverlayOpacity(opacity);
      },
    );
    return () => {
      if (removeOpacityListener) removeOpacityListener();
    };
  }, [isOverlayWindow]);

  // When the theme switches and no user preference is stored, reset to theme-aware default
  useEffect(() => {
    if (!isOverlayWindow || !window.electronAPI?.onThemeChanged) return;
    return window.electronAPI.onThemeChanged(() => {
      const stored = localStorage.getItem("momor_overlay_opacity");
      if (!stored) {
        setOverlayOpacity(getDefaultOverlayOpacity());
      }
    });
  }, [isOverlayWindow]);

  useEffect(() => {
    const handleStorage = () =>
      setMeetingInterfaceThemeState(getMeetingInterfaceTheme());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Handlers
  const handleReindex = async () => {
    if (window.electronAPI?.reindexIncompatibleMeetings) {
      setIncompatibleWarning(null);
      await window.electronAPI.reindexIncompatibleMeetings();
    }
  };

  const handleStartMeeting = async () => {
    try {
      localStorage.setItem("momor_last_meeting_start", Date.now().toString());
      const inputDeviceId = localStorage.getItem("preferredInputDeviceId");
      let outputDeviceId = localStorage.getItem("preferredOutputDeviceId");
      const useExperimentalSck =
        localStorage.getItem("useExperimentalSckBackend") === "true";

      // Override output device ID to force SCK if experimental mode is enabled
      // Default to CoreAudio unless experimental is enabled
      if (useExperimentalSck) {
        console.log("[App] Using ScreenCaptureKit backend (Experimental).");
        outputDeviceId = "sck";
      } else {
        console.log("[App] Using CoreAudio backend (Default).");
      }

      const meetingRetention = await window.electronAPI
        .getMeetingRetention?.()
        .catch(() => "forever");
      const result = await window.electronAPI.startMeeting({
        audio: { inputDeviceId, outputDeviceId },
        doNotPersist: meetingRetention === "never",
      });
      if (result.success) {
        analytics.trackMeetingStarted();
        // Window swap happens inside main's startMeeting() now (before the
        // meeting-state broadcast) to avoid a blue→green CTA flash on the
        // launcher. No follow-up setWindowMode IPC needed here.
      } else {
        console.error("Failed to start meeting:", result.error);
      }
    } catch (err) {
      console.error("Failed to start meeting:", err);
    }
  };

  const handleEndMeeting = () => {
    console.log("[App.tsx] handleEndMeeting triggered");
    analytics.trackMeetingEnded();
    setIsProcessingMeeting(true);

    // Local bookkeeping that does not depend on the main process.
    const startStr = localStorage.getItem("momor_last_meeting_start");
    if (startStr) {
      const duration = Date.now() - parseInt(startStr, 10);
      localStorage.removeItem("momor_last_meeting_start");
    }

    // Fire-and-forget: main's endMeeting() handler now performs the
    // launcher swap synchronously at the top, BEFORE any blocking audio
    // teardown. Awaiting here would stall the overlay's React render
    // loop for the IPC round-trip while libuv-blocking setImmediate
    // native stops fire on the main process — which is the lag the user
    // was seeing. The launcher window receives a 'meetings-updated'
    // event after the BG teardown so its list refreshes on its own.
    window.electronAPI.endMeeting().catch((err) => {
      console.error("Failed to end meeting:", err);
      // Belt-and-suspenders: if the IPC itself rejected, the swap may
      // not have happened — request it manually so the user isn't
      // stranded on a dead overlay.
      window.electronAPI.setWindowMode("launcher");
    });
  };

  // Render Logic
  if (isSettingsWindow) {
    return (
      <ErrorBoundary context="SettingsPopup">
        <div className="h-full min-h-0 w-full bg-background">
          <AppProviders>
            <SettingsPopup />
          </AppProviders>
        </div>
      </ErrorBoundary>
    );
  }

  if (isModelSelectorWindow) {
    return (
      <ErrorBoundary context="ModelSelector">
        <div className="h-full min-h-0 w-full overflow-hidden bg-background">
          <AppProviders>
            <ModelSelectorWindow />
          </AppProviders>
        </div>
      </ErrorBoundary>
    );
  }

  // --- OVERLAY WINDOW (Meeting Interface) ---
  if (isOverlayWindow) {
    return (
      <ErrorBoundary context="Overlay">
        <div className="w-full relative bg-transparent">
          <AppProviders>
            <div
              style={
                {
                  ["--overlay-opacity" as "--overlay-opacity"]:
                    String(overlayOpacity),
                  transition:
                    "background-color 75ms ease, border-color 75ms ease, box-shadow 75ms ease",
                } as React.CSSProperties
              }
            >
              <MomorInterface
                onEndMeeting={handleEndMeeting}
                overlayOpacity={overlayOpacity}
                interfaceTheme={meetingInterfaceTheme}
              />
            </div>
          </AppProviders>
        </div>
      </ErrorBoundary>
    );
  }

  // --- LAUNCHER WINDOW (Default) ---
  // Renders if window=launcher OR no param
  return (
    <ErrorBoundary context="Launcher">
      <div className="h-full min-h-0 w-full relative bg-background">
        <AnimatePresence>
          {showStartup ? (
            <motion.div
              key="startup"
              initial={{ opacity: 1 }}
              exit={{
                opacity: 0,
                scale: 1.1,
                pointerEvents: "none",
                transition: { duration: 0.6, ease: "easeInOut" },
              }}
            >
              <StartupSequence
                onComplete={() => {
                  try {
                    localStorage.setItem("momor_seen_startup_v1", "true");
                  } catch {}
                  setShowStartup(false);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="main"
              className="h-full w-full"
              initial={{ opacity: 0, scale: 0.98, y: 15 }} // "Linear" style entry: slightly down and scaled down
              animate={{ opacity: 1, scale: 1, y: 0 }} // Slide up and snap to place
              transition={{
                duration: 0.8,
                ease: [0.19, 1, 0.22, 1], // Expo-out: snappy start, smooth landing
                delay: 0.1,
              }}
            >
              <AppProviders>
                  <div
                    id="launcher-container"
                    className="h-full w-full relative"
                  >
                    <Launcher
                      onStartMeeting={handleStartMeeting}
                      onOpenSettings={(tab = "general") =>
                        openSettingsExclusive(tab)
                      }
                      onPageChange={setIsLauncherMainView}
                      ollamaPullStatus={ollamaPullStatus}
                      ollamaPullPercent={ollamaPullPercent}
                      ollamaPullMessage={ollamaPullMessage}
                    />
                  </div>
                  <SettingsOverlay
                    isOpen={isSettingsOpen}
                    onClose={() => {
                      setIsSettingsOpen(false);
                    }}
                    initialTab={settingsInitialTab}
                  />
              </AppProviders>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {incompatibleWarning && isDefault && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed bottom-6 right-6 z-50 pointer-events-auto"
            >
              <Card className="max-w-[340px] border-destructive/30 shadow-2xl">
                <CardContent className="p-5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-foreground font-medium text-sm">
                      {t('app.providerChanged')}
                    </h3>
                    <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                      ⚠ {t('app.incompatibleWarning', { count: incompatibleWarning.count, oldProvider: incompatibleWarning.oldProvider, newProvider: incompatibleWarning.newProvider })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-1 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIncompatibleWarning(null)}
                  >
                    {t('app.dismiss')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReindex}
                  >
                    {t('app.reindex')}
                  </Button>
                </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <UpdateBanner />
        <MomorQuotaBanner />

        {/* Free trial countdown banner — only in launcher window while trial is active */}
        {(isLauncherWindow || isDefault) && activeTrial && (
          <FreeTrialBanner
            expiresAt={activeTrial.expiresAt}
            usage={activeTrial.usage}
            onUpgrade={() => openSettingsExclusive("api")}
          />
        )}


        {/* Trial promo toaster — 5s after restart (self-gates via localStorage + conditions) */}
        <TrialPromoToaster
          isOpen={showTrialPromo}
          hasmomorKey={hasmomorApi}
          hasTrialToken={!!activeTrial}
          onDismiss={() => setShowTrialPromo(false)}
          onStartTrial={async () => {
            const res = await window.electronAPI?.startTrial?.();
            if (!res?.ok)
              throw new Error(res?.error || "Could not start trial");
            if (res.expires_at) {
              setActiveTrial({
                expiresAt: res.expires_at,
                usage: res.usage ?? { ai: 0, stt_seconds: 0, search: 0 },
              });
            }
            setShowTrialPromo(false);
          }}
          onManualSetup={() => {
            setShowTrialPromo(false);
            openSettingsExclusive("api");
          }}
        />

        {/* Post-trial upgrade modal — shown when trial expires */}
        {(isLauncherWindow || isDefault) && showTrialExpiredModal && (
          <FreeTrialModal
            usage={activeTrial?.usage ?? { ai: 0, stt_seconds: 0, search: 0 }}
            onByok={async () => {
              await window.electronAPI?.endTrialByok?.();
            }}
            onStandard={async () => {
              // Wipe resume + JD (orchestrator caches + SQLite) before checkout opens
              await window.electronAPI
                ?.wipeTrialProfileData?.()
                .catch(() => {});
              // Revert active mode to none — Standard plan has no modes access
              await window.electronAPI?.modesSetActive?.(null).catch(() => {});
            }}
            onDone={() => {
              setShowTrialExpiredModal(false);
              setActiveTrial(null);
            }}
          />
        )}
        {/* Ad toasters — render whenever activeAd is set (isLauncherMainView guard bypassed
          when triggered via preview shortcut so the card always surfaces) */}
        {(isLauncherMainView || !!activeAd) && !isSettingsOpen && (
          <MomorApiPromoToaster
            isOpen={activeAd === "momor_api"}
            onDismiss={() => dismissAd("momor_api")}
            onOpenSettings={(tab: string) => openSettingsExclusive(tab)}
          />
        )}
        {(isLauncherMainView || !!activeAd) && (
          <>
            <PremiumPromoToaster
              isOpen={activeAd === "promo"}
              onDismiss={dismissAd}
              onUpgrade={() => {
                setShowPremiumModal(true);
              }}
            />
            <MaxUltraUpgradeToaster
              isOpen={activeAd === "max_ultra_upgrade"}
              onDismiss={dismissAd}
              onUpgrade={() => {
                setShowPremiumModal(true);
              }}
            />

            {/* Remote Campaigns Render Logic */}
            <RemoteCampaignToaster
              isOpen={typeof activeAd === "object" && activeAd !== null}
              campaign={
                typeof activeAd === "object" && activeAd !== null
                  ? activeAd
                  : (undefined as any)
              }
              onDismiss={dismissAd}
            />
          </>
        )}

        <PremiumUpgradeModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          isPremium={isPremiumActive}
          onActivated={() => {
            setIsPremiumActive(true);
            // Refresh full plan details after activation so ad targeting reflects the new plan
            window.electronAPI
              ?.licenseGetDetails?.()
              .then((d) => setPlanDetails(d ?? { isPremium: true }))
              .catch(() => setPlanDetails({ isPremium: true }));
            setShowPremiumModal(false);
            // If user activated during post-trial modal, close it — they have a plan now
            setShowTrialExpiredModal(false);
            setActiveTrial(null);
          }}
          onDeactivated={() => {
            setIsPremiumActive(false);
            setPlanDetails({ isPremium: false });
          }}
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;
