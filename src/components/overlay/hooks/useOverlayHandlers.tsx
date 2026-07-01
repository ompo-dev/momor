import React, { useCallback } from "react";
import { animate } from "framer-motion";
import { Message } from "../../momorShared";
import OverlayMessageContent from "../organisms/OverlayMessageContent";
import {
  getActiveProfile,
  getActiveProfileListeningFlags,
  loadUserSessionData,
} from "../../../lib/userSessionContext";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface Use_syncAnswerCallSessionDeps {
  answerCallSessionActiveRef: Ref;
  setAnswerCallSessionActive: Setter;
}
export function use_syncAnswerCallSession({
  answerCallSessionActiveRef,
  setAnswerCallSessionActive,
}: Use_syncAnswerCallSessionDeps) {
  const syncAnswerCallSession = useCallback((active: boolean) => {
    answerCallSessionActiveRef.current = active;
    setAnswerCallSessionActive(active);
  }, []);

  return syncAnswerCallSession;
}

interface Use_refreshProfileListeningRefsDeps {
  activeListeningEnabledRef: Ref;
  autoSuggestEnabledRef: Ref;
  setActiveListeningSessionActive: Setter;
}
export function use_refreshProfileListeningRefs({
  activeListeningEnabledRef,
  autoSuggestEnabledRef,
  setActiveListeningSessionActive,
}: Use_refreshProfileListeningRefsDeps) {
  const refreshProfileListeningRefs = useCallback(() => {
    const flags = getActiveProfileListeningFlags(
      getActiveProfile(loadUserSessionData()),
    );
    activeListeningEnabledRef.current = flags.activeListening;
    autoSuggestEnabledRef.current = flags.autoSuggestResponses;
    void window.electronAPI?.setActiveListeningMode?.(flags.activeListening);
    if (!flags.activeListening) {
      setActiveListeningSessionActive(false);
    }
  }, []);

  return refreshProfileListeningRefs;
}

interface Use_triggerAnswerNowEndpointDeps {
  answerAutoFinishRef: Ref;
  finishAnswerNowTurnRef: Ref;
  isRecordingRef: Ref;
}
export function use_triggerAnswerNowEndpoint({
  answerAutoFinishRef,
  finishAnswerNowTurnRef,
  isRecordingRef,
}: Use_triggerAnswerNowEndpointDeps) {
  const triggerAnswerNowEndpoint = useCallback(() => {
    if (!isRecordingRef.current || answerAutoFinishRef.current) return;
    answerAutoFinishRef.current = true;
    void finishAnswerNowTurnRef.current?.(true);
  }, []);

  return triggerAnswerNowEndpoint;
}

interface Use_handleModelSelectDeps {
  setCurrentModel: Setter;
}
export function use_handleModelSelect({
  setCurrentModel,
}: Use_handleModelSelectDeps) {
  const handleModelSelect = (modelId: string) => {
    setCurrentModel(modelId);
    // Session-only: update runtime but don't persist as default
    window.electronAPI
      .setModel(modelId)
      .catch((err: any) => console.error("Failed to set model:", err));
  };

  return handleModelSelect;
}

interface Use_refreshSttProfileUiDeps {
  setCurrentSttLabel: Setter;
  setCurrentSttProfileId: Setter;
  setSttNotConfigured: Setter;
}
export function use_refreshSttProfileUi({
  setCurrentSttLabel,
  setCurrentSttProfileId,
  setSttNotConfigured,
}: Use_refreshSttProfileUiDeps) {
  const refreshSttProfileUi = useCallback(async () => {
    try {
      const res = await window.electronAPI?.getSttProfiles?.();
      if (!res?.success) return;
      const activeId = res.activeProfileId ?? res.defaultProfileId;
      const active = res.profiles.find((p) => p.id === activeId);
      setCurrentSttProfileId(activeId);
      setCurrentSttLabel(active?.name ?? active?.kind ?? "STT");
      setSttNotConfigured(!res.activeConfigured);
    } catch {
      /* ignore */
    }
  }, []);

  return refreshSttProfileUi;
}

interface Use_reportShellSizeDeps {
  STABLE_OVERLAY_WIDTH: any;
  contentRef: Ref;
  isExpandedRef: Ref;
}
export function use_reportShellSize({
  STABLE_OVERLAY_WIDTH,
  contentRef,
  isExpandedRef,
}: Use_reportShellSizeDeps) {
  const reportShellSize = useCallback(() => {
    if (!contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const width = isExpandedRef.current
      ? STABLE_OVERLAY_WIDTH
      : Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    const api = window.electronAPI as any;
    if (api?.updateContentDimensionsCentered) {
      api.updateContentDimensionsCentered({ width, height });
    } else {
      window.electronAPI?.updateContentDimensions({ width, height });
    }
  }, [STABLE_OVERLAY_WIDTH]);

  return reportShellSize;
}

interface Use_startTransitionDeps {
  SHELL_WIDTH_EXPANDED: any;
  animationControlsRef: Ref;
  codeExpandedRef: Ref;
  scrollContainerRef: Ref;
  shellWidth: any;
  wasAtBottomRef: Ref;
}
export function use_startTransition({
  SHELL_WIDTH_EXPANDED,
  animationControlsRef,
  codeExpandedRef,
  scrollContainerRef,
  shellWidth,
  wasAtBottomRef,
}: Use_startTransitionDeps) {
  const startTransition = useCallback(
    (targetWidth: number) => {
      codeExpandedRef.current = targetWidth === SHELL_WIDTH_EXPANDED;
      if (animationControlsRef.current) animationControlsRef.current.stop();

      // iMessage-style sticky bottom. Capture the user's scroll intent now,
      // before scrollMaxH starts changing. If they were at (or near) the
      // bottom, we keep them pinned there throughout the spring so growing
      // viewport height doesn't reveal stale history below the visible chat.
      // If they were scrolled up to read history, we leave their position
      // alone — the extra viewport extends downward into empty space, which
      // is the correct behavior for a reader.
      const container = scrollContainerRef.current;
      if (container) {
        const distanceFromBottom =
          container.scrollHeight -
          (container.scrollTop + container.clientHeight);
        wasAtBottomRef.current = distanceFromBottom <= 8;
      }

      // Symmetric ease-in-out-cubic. Smooth ramp on both ends — no perceived
      // velocity break at the start or finish, which is what makes a width
      // animation read as "buttery" rather than "snappy". The cubic poly
      // is gentle enough that the 1px-per-frame motion at the edges is
      // visually subliminal at 60Hz, eliminating the "settle" jitter you
      // get with steeper ease-out curves on width-driven reflow.
      animationControlsRef.current = animate(shellWidth, targetWidth, {
        type: "tween" as const,
        ease: [0.65, 0, 0.35, 1],
        duration: 0.7,
        onUpdate: () => {
          if (!wasAtBottomRef.current) return;
          const c = scrollContainerRef.current;
          if (!c) return;
          // scrollMaxH is derived from shellWidth, so on every tick the
          // viewport height has just changed. Re-pin to bottom in the
          // SAME frame — single layout read, single write, no flush.
          c.scrollTop = c.scrollHeight - c.clientHeight;
        },
        onComplete: () => {
          animationControlsRef.current = null;
        },
      });
    },
    [shellWidth, SHELL_WIDTH_EXPANDED],
  );

  return startTransition;
}

interface Use_handleScreenshotAttachDeps {
  setAttachedContext: Setter;
  setIsExpanded: Setter;
}
export function use_handleScreenshotAttach({
  setAttachedContext,
  setIsExpanded,
}: Use_handleScreenshotAttachDeps) {
  const handleScreenshotAttach = (data: { path: string; preview: string }) => {
    setIsExpanded(true);
    setAttachedContext((prev) => {
      // Prevent duplicates and cap at 5
      if (prev.some((s: any) => s.path === data.path)) return prev;
      const updated = [...prev, data];
      return updated.slice(-5); // Keep last 5
    });
  };

  return handleScreenshotAttach;
}

interface Use_clearChatDeps {
  setMessages: Setter;
}
export function use_clearChat({ setMessages }: Use_clearChatDeps) {
  const clearChat = () => {
    setMessages([]);
  };

  return clearChat;
}

interface Use_renderMessageTextDeps {
  appearance: any;
  codeBlockClass: any;
  codeHeaderClass: any;
  codeHeaderTextClass: any;
  codeLineNumberColor: any;
  codeTheme: any;
  isLightTheme: any;
  mdComponents: any;
  setMessages: Setter;
  subtleSurfaceClass: any;
}
export function use_renderMessageText({
  appearance,
  codeBlockClass,
  codeHeaderClass,
  codeHeaderTextClass,
  codeLineNumberColor,
  codeTheme,
  isLightTheme,
  mdComponents,
  setMessages,
  subtleSurfaceClass,
}: Use_renderMessageTextDeps) {
  const renderMessageText = useCallback(
    (msg: Message) => (
      <OverlayMessageContent
        msg={msg}
        isLightTheme={isLightTheme}
        appearance={appearance}
        subtleSurfaceClass={subtleSurfaceClass}
        codeTheme={codeTheme}
        codeBlockClass={codeBlockClass}
        codeHeaderClass={codeHeaderClass}
        codeHeaderTextClass={codeHeaderTextClass}
        codeLineNumberColor={codeLineNumberColor}
        mdComponents={mdComponents}
        onNegotiationSilenceEnd={(id: string) =>
          setMessages((prev) =>
            prev.map((m: any) =>
              m.id === id
                ? {
                    ...m,
                    negotiationCoachingData: m.negotiationCoachingData
                      ? {
                          ...m.negotiationCoachingData,
                          showSilenceTimer: false,
                        }
                      : undefined,
                  }
                : m,
            ),
          )
        }
      />
    ),
    [
      isLightTheme,
      mdComponents,
      appearance,
      subtleSurfaceClass,
      codeTheme,
      codeBlockClass,
      codeHeaderClass,
      codeHeaderTextClass,
      codeLineNumberColor,
    ],
  );

  return renderMessageText;
}

interface Use_blockInputFocusDeps {
  stealthAutoEngageOkRef: Ref;
  stealthTapAvailableRef: Ref;
  textInputRef: Ref;
}
export function use_blockInputFocus({
  stealthAutoEngageOkRef,
  stealthTapAvailableRef,
  textInputRef,
}: Use_blockInputFocusDeps) {
  const blockInputFocus = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (!stealthTapAvailableRef.current) return;
      // When auto-engage is disabled (composition IME present), the click
      // does NOT engage the tap — so blocking DOM focus would leave the
      // user with no way to type. Let the browser focus the input so the
      // OS Text Input System can route keystrokes through the active IME
      // and compose CJK characters normally.
      if (!stealthAutoEngageOkRef.current) return;
      e.preventDefault();
      // Don't blur an already-focused element — that itself fires events.
      if (document.activeElement === textInputRef.current) {
        textInputRef.current?.blur();
      }
    },
    [],
  );

  return blockInputFocus;
}

interface Use_copyDiagnosticsDeps {
  sttUserStatus: any;
  sttUserProvider: any;
  sttInterviewerStatus: any;
  sttInterviewerProvider: any;
  sttInterviewerError: any;
  sttUserError: any;
}
export function use_copyDiagnostics({
  sttUserStatus,
  sttUserProvider,
  sttInterviewerStatus,
  sttInterviewerProvider,
  sttInterviewerError,
  sttUserError,
}: Use_copyDiagnosticsDeps) {
  const copyDiagnostics = async () => {
    const version = import.meta.env.VITE_APP_VERSION || "unknown";
    const [arch, osVersion] = await Promise.all([
      window.electronAPI?.getArch?.().catch(() => "unknown"),
      window.electronAPI?.getOsVersion?.().catch(() => "unknown"),
    ]);
    const { categorizeSttError } = await import("../../../lib/sttErrorMapper");
    const userCat = sttUserError ? categorizeSttError(sttUserError) : null;
    const interviewerCat = sttInterviewerError
      ? categorizeSttError(sttInterviewerError)
      : null;
    const report = [
      "## STT Diagnostic Report",
      `App Version: ${version}`,
      `Platform: ${osVersion} (${arch})`,
      `---`,
      `Microphone Provider: ${sttUserProvider}`,
      `Microphone Status: ${sttUserStatus}`,
      userCat
        ? `Microphone Category: ${userCat.title} [${userCat.category}]`
        : "",
      `Microphone Error: ${sttUserError || "N/A"}`,
      `---`,
      `System Audio Provider: ${sttInterviewerProvider}`,
      `System Audio Status: ${sttInterviewerStatus}`,
      interviewerCat
        ? `System Audio Category: ${interviewerCat.title} [${interviewerCat.category}]`
        : "",
      `System Audio Error: ${sttInterviewerError || "N/A"}`,
      `Timestamp: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return copyDiagnostics;
}

interface Use_handleSttProfileSelectDeps {
  refreshSttProfileUi: any;
}
export function use_handleSttProfileSelect({
  refreshSttProfileUi,
}: Use_handleSttProfileSelectDeps) {
  const handleSttProfileSelect = (profileId: string) => {
    window.electronAPI
      ?.setSttProfile?.(profileId)
      .then(() => refreshSttProfileUi())
      .catch((err: unknown) =>
        console.error("Failed to set STT profile:", err),
      );
  };

  return handleSttProfileSelect;
}

interface Use_checkCodeVisibilityDeps {
  SHELL_WIDTH_COLLAPSED: any;
  SHELL_WIDTH_EXPANDED: any;
  STABILITY_MS: any;
  codeExpandedRef: Ref;
  pendingVisibilityRef: Ref;
  scrollContainerRef: Ref;
  stableVisibilityTimerRef: Ref;
  startTransition: any;
}
export function use_checkCodeVisibility({
  SHELL_WIDTH_COLLAPSED,
  SHELL_WIDTH_EXPANDED,
  STABILITY_MS,
  codeExpandedRef,
  pendingVisibilityRef,
  scrollContainerRef,
  stableVisibilityTimerRef,
  startTransition,
}: Use_checkCodeVisibilityDeps) {
  const checkCodeVisibility = useCallback(() => {
    const container = scrollContainerRef.current;

    // Scroll container unmounted (session reset / messages cleared) — force
    // contraction so the shell returns to its collapsed width.
    if (!container) {
      if (stableVisibilityTimerRef.current) {
        clearTimeout(stableVisibilityTimerRef.current);
        stableVisibilityTimerRef.current = null;
      }
      pendingVisibilityRef.current = null;
      if (codeExpandedRef.current) startTransition(SHELL_WIDTH_COLLAPSED);
      return;
    }

    const codeEls = container.querySelectorAll("[data-code-msg]");
    let visible = false;
    if (codeEls.length > 0) {
      const cRect = container.getBoundingClientRect();
      for (const el of codeEls) {
        const r = el.getBoundingClientRect();
        if (r.bottom > cRect.top && r.top < cRect.bottom) {
          visible = true;
          break;
        }
      }
    }

    // Already in the correct state — clear any pending change so a
    // mid-flight tween isn't interrupted by a stale timer firing.
    if (visible === codeExpandedRef.current) {
      pendingVisibilityRef.current = null;
      if (stableVisibilityTimerRef.current) {
        clearTimeout(stableVisibilityTimerRef.current);
        stableVisibilityTimerRef.current = null;
      }
      return;
    }

    // State change detected. If we're already waiting on the SAME pending
    // change, let the timer continue ticking — don't reset it on every
    // scroll frame, or fast scroll would never let the timer fire.
    if (pendingVisibilityRef.current === visible) return;

    pendingVisibilityRef.current = visible;
    if (stableVisibilityTimerRef.current)
      clearTimeout(stableVisibilityTimerRef.current);
    stableVisibilityTimerRef.current = setTimeout(() => {
      stableVisibilityTimerRef.current = null;
      const target = pendingVisibilityRef.current;
      pendingVisibilityRef.current = null;
      if (target !== null && target !== codeExpandedRef.current) {
        startTransition(target ? SHELL_WIDTH_EXPANDED : SHELL_WIDTH_COLLAPSED);
      }
    }, STABILITY_MS);
  }, [startTransition, SHELL_WIDTH_COLLAPSED, SHELL_WIDTH_EXPANDED]);

  return checkCodeVisibility;
}
