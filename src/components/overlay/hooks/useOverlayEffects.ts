import React, { useEffect } from "react";

type Setter = (value: any) => void;
type Ref = React.MutableRefObject<any>;
type Fn = (...args: any[]) => any;

interface UseDefaultModelLoaderDeps {
  setCurrentModel: Setter;
}

/** Relocated effect (verbatim, deps array unchanged). */
export function useDefaultModelLoader({
  setCurrentModel,
}: UseDefaultModelLoaderDeps) {
  useEffect(() => {
    // Load the persisted default model (not the runtime model)
    // Each new meeting starts with the default from settings
    if (window.electronAPI?.getDefaultModel) {
      window.electronAPI
        .getDefaultModel()
        .then((result: any) => {
          if (result && result.model) {
            setCurrentModel(result.model);
            // Also set the runtime model to the default
            window.electronAPI.setModel(result.model).catch(() => {});
          }
        })
        .catch((err: any) =>
          console.error("Failed to fetch default model:", err),
        );
    }
  }, []);
}

interface UseSttConfigListenerDeps {
  refreshSttProfileUi: Fn;
  setSttNotConfigured: Setter;
}

/** Relocated effect (verbatim, deps array unchanged). */
export function useSttConfigListener({
  refreshSttProfileUi,
  setSttNotConfigured,
}: UseSttConfigListenerDeps) {
  useEffect(() => {
    let mounted = true;
    void refreshSttProfileUi();

    const unsubConfig = window.electronAPI?.onSttConfigChanged?.(
      (data: { configured: boolean }) => {
        if (mounted) setSttNotConfigured(!data.configured);
      },
    );
    const unsubProfile = window.electronAPI?.onSttProfileChanged?.(() => {
      if (mounted) void refreshSttProfileUi();
    });
    return () => {
      mounted = false;
      unsubConfig?.();
      unsubProfile?.();
    };
  }, [refreshSttProfileUi]);
}

interface UseScrollCodeVisibilityDeps {
  scrollContainerRef: Ref;
  checkCodeVisibility: Fn;
  messages: any;
}

/** Relocated effect (verbatim, deps array unchanged). */
export function useScrollCodeVisibility({
  scrollContainerRef,
  checkCodeVisibility,
  messages,
}: UseScrollCodeVisibilityDeps) {
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        checkCodeVisibility();
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [messages, checkCodeVisibility]);
}

interface UseOverlayUnmountCleanupDeps {
  animationControlsRef: Ref;
  rafDimUpdateRef: Ref;
  stableVisibilityTimerRef: Ref;
  pendingVisibilityRef: Ref;
  tokenBufRef: Ref;
}

/** Relocated effect (verbatim, deps array unchanged). */
export function useOverlayUnmountCleanup({
  animationControlsRef,
  rafDimUpdateRef,
  stableVisibilityTimerRef,
  pendingVisibilityRef,
  tokenBufRef,
}: UseOverlayUnmountCleanupDeps) {
  useEffect(() => {
    return () => {
      animationControlsRef.current?.stop();
      animationControlsRef.current = null;
      if (rafDimUpdateRef.current) {
        cancelAnimationFrame(rafDimUpdateRef.current);
        rafDimUpdateRef.current = null;
      }
      if (stableVisibilityTimerRef.current) {
        clearTimeout(stableVisibilityTimerRef.current);
        stableVisibilityTimerRef.current = null;
      }
      pendingVisibilityRef.current = null;
      // PERF: cancel any pending token-flush RAF so we don't try to
      // setState on an unmounted component.
      if (tokenBufRef.current.raf !== null) {
        cancelAnimationFrame(tokenBufRef.current.raf);
        tokenBufRef.current.raf = null;
        tokenBufRef.current.text = "";
      }
    };
  }, []);
}

interface UseUserContextSyncDeps {
  syncUserSessionContextToMain: Fn;
  refreshProfileListeningRefs: Fn;
  activeListeningEnabledRef: Ref;
  answerCallSessionActiveRef: Ref;
  isRecordingRef: Ref;
  applyActiveListeningOnMeetingStartRef: Ref;
  USER_CONTEXT_CHANGED_EVENT: any;
}

/** Relocated effect (verbatim, deps array unchanged). */
export function useUserContextSync({
  syncUserSessionContextToMain,
  refreshProfileListeningRefs,
  activeListeningEnabledRef,
  answerCallSessionActiveRef,
  isRecordingRef,
  applyActiveListeningOnMeetingStartRef,
  USER_CONTEXT_CHANGED_EVENT,
}: UseUserContextSyncDeps) {
  useEffect(() => {
    void syncUserSessionContextToMain();
    refreshProfileListeningRefs();
    const onProfileChanged = () => {
      void syncUserSessionContextToMain();
      refreshProfileListeningRefs();
      if (
        activeListeningEnabledRef.current &&
        !answerCallSessionActiveRef.current &&
        !isRecordingRef.current
      ) {
        void applyActiveListeningOnMeetingStartRef.current?.();
      }
    };
    window.addEventListener(USER_CONTEXT_CHANGED_EVENT, onProfileChanged);
    return () =>
      window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, onProfileChanged);
  }, [refreshProfileListeningRefs]);
}

interface UseAnswerEndpointWatcherDeps {
  isManualRecording: any;
  answerSttHadSpeechRef: Ref;
  isRecordingRef: Ref;
  answerAutoFinishRef: Ref;
  answerSttLastActivityRef: Ref;
  getAnswerCallEndpointPauseMs: Fn;
  triggerAnswerNowEndpoint: Fn;
}

/** Relocated effect (verbatim, deps array unchanged). */
export function useAnswerEndpointWatcher({
  isManualRecording,
  answerSttHadSpeechRef,
  isRecordingRef,
  answerAutoFinishRef,
  answerSttLastActivityRef,
  getAnswerCallEndpointPauseMs,
  triggerAnswerNowEndpoint,
}: UseAnswerEndpointWatcherDeps) {
  useEffect(() => {
    if (!isManualRecording) {
      answerSttHadSpeechRef.current = false;
      return;
    }
    const tick = window.setInterval(() => {
      if (!isRecordingRef.current || answerAutoFinishRef.current) return;
      if (!answerSttHadSpeechRef.current) return;
      const quiet = Date.now() - answerSttLastActivityRef.current;
      if (quiet >= getAnswerCallEndpointPauseMs()) {
        triggerAnswerNowEndpoint();
      }
    }, 80);
    return () => window.clearInterval(tick);
  }, [isManualRecording, triggerAnswerNowEndpoint]);
}
