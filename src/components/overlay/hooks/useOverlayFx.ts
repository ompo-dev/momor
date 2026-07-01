import React, { useEffect } from "react";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface UseOverlayFx1Deps {
  setShowTranscript: Setter;
}

export function useOverlayFx1({
  setShowTranscript,
}: UseOverlayFx1Deps) {
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("momor_interviewer_transcript");
      setShowTranscript(stored !== "false");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
}

interface UseOverlayFx2Deps {
  setAutoScroll: Setter;
}

export function useOverlayFx2({
  setAutoScroll,
}: UseOverlayFx2Deps) {
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("momor_auto_scroll");
      setAutoScroll(stored === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
}

interface UseOverlayFx3Deps {
  autoScroll: any;
  messages: any[];
  messagesEndRef: Ref;
}

export function useOverlayFx3({
  autoScroll,
  messages,
  messagesEndRef,
}: UseOverlayFx3Deps) {
  useEffect(() => {
    if (!autoScroll) return;
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, autoScroll]);
}

interface UseOverlayFx4Deps {
  setCurrentModel: Setter;
}

export function useOverlayFx4({
  setCurrentModel,
}: UseOverlayFx4Deps) {
  useEffect(() => {
    if (!window.electronAPI?.onModelChanged) return;
    const unsubscribe = window.electronAPI.onModelChanged((modelId: string) => {
      setCurrentModel((prev) => (prev === modelId ? prev : modelId));
    });
    return () => unsubscribe();
  }, []);
}

interface UseOverlayFx5Deps {
  setIsUndetectable: Setter;
}

export function useOverlayFx5({
  setIsUndetectable,
}: UseOverlayFx5Deps) {
  useEffect(() => {
    // Fetch initial state
    if (window.electronAPI?.getUndetectable) {
      window.electronAPI.getUndetectable().then(setIsUndetectable);
    }

    if (window.electronAPI?.onUndetectableChanged) {
      const unsubscribe = window.electronAPI.onUndetectableChanged((state) => {
        setIsUndetectable(state);
      });
      return () => unsubscribe();
    }
  }, []);
}

interface UseOverlayFx6Deps {
  hideChatHidesWidget: any;
  isUndetectable: any;
}

export function useOverlayFx6({
  hideChatHidesWidget,
  isUndetectable,
}: UseOverlayFx6Deps) {
  useEffect(() => {
    localStorage.setItem("momor_undetectable", String(isUndetectable));
    localStorage.setItem(
      "momor_hideChatHidesWidget",
      String(hideChatHidesWidget),
    );
  }, [isUndetectable, hideChatHidesWidget]);
}

interface UseOverlayFx7Deps {
  setIsMousePassthrough: Setter;
}

export function useOverlayFx7({
  setIsMousePassthrough,
}: UseOverlayFx7Deps) {
  useEffect(() => {
    window.electronAPI
      ?.getOverlayMousePassthrough?.()
      .then(setIsMousePassthrough)
      .catch(() => {});
    const unsub = window.electronAPI?.onOverlayMousePassthroughChanged?.((v) =>
      setIsMousePassthrough(v),
    );
    return () => unsub?.();
  }, []);
}

interface UseOverlayFx8Deps {
  setIsExpanded: Setter;
  setSystemAudioWarning: Setter;
}

export function useOverlayFx8({
  setIsExpanded,
  setSystemAudioWarning,
}: UseOverlayFx8Deps) {
  useEffect(() => {
    const unsub = window.electronAPI?.onSystemAudioPermissionDenied?.(
      (message: string) => {
        setSystemAudioWarning(message);
        setIsExpanded(true); // Force overlay open so user sees the warning
      },
    );
    return () => unsub?.();
  }, []);
}

interface UseOverlayFx9Deps {
  setIsExpanded: Setter;
  setSystemAudioWarning: Setter;
}

export function useOverlayFx9({
  setIsExpanded,
  setSystemAudioWarning,
}: UseOverlayFx9Deps) {
  useEffect(() => {
    const unsub = window.electronAPI?.onAudioCaptureFailed?.((payload) => {
      if (payload.channel !== "system") return; // mic failures already shown via STT status
      // Only surface terminal failures or the stuck signal — transient
      // recovery attempts shouldn't spam the banner since recovery
      // typically succeeds within ~1.5s.
      if (payload.terminal || payload.stuck) {
        setSystemAudioWarning(payload.message);
        setIsExpanded(true);
      }
    });
    return () => unsub?.();
  }, []);
}

interface UseOverlayFx10Deps {
  isExpanded: any;
  isExpandedRef: Ref;
}

export function useOverlayFx10({
  isExpanded,
  isExpandedRef,
}: UseOverlayFx10Deps) {
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);
}

interface UseOverlayFx11Deps {
  isCollapsed: any;
  isCollapsedRef: Ref;
  reportShellSize: any;
}

export function useOverlayFx11({
  isCollapsed,
  isCollapsedRef,
  reportShellSize,
}: UseOverlayFx11Deps) {
  useEffect(() => {
    isCollapsedRef.current = isCollapsed;
    const id = requestAnimationFrame(() => reportShellSize());
    return () => cancelAnimationFrame(id);
  }, [isCollapsed]);
}

interface UseOverlayFx12Deps {
  isCollapsed: any;
  isExpanded: any;
  setIsCollapsed: Setter;
}

export function useOverlayFx12({
  isCollapsed,
  isExpanded,
  setIsCollapsed,
}: UseOverlayFx12Deps) {
  useEffect(() => {
    if (!isExpanded && isCollapsed) setIsCollapsed(false);
  }, [isExpanded, isCollapsed]);
}

interface UseOverlayFx13Deps {
  isProcessing: any;
  setAgentTools: Setter;
}

export function useOverlayFx13({
  isProcessing,
  setAgentTools,
}: UseOverlayFx13Deps) {
  useEffect(() => {
    if (isProcessing) setAgentTools([]);
  }, [isProcessing]);
}

interface UseOverlayFx14Deps {
  attachedContext: any;
  reportShellSize: any;
}

export function useOverlayFx14({
  attachedContext,
  reportShellSize,
}: UseOverlayFx14Deps) {
  useEffect(() => {
    const id = requestAnimationFrame(reportShellSize);
    return () => cancelAnimationFrame(id);
  }, [attachedContext, reportShellSize]);
}

interface UseOverlayFx15Deps {
  attachedContext: any;
  textInputRef: Ref;
}

export function useOverlayFx15({
  attachedContext,
  textInputRef,
}: UseOverlayFx15Deps) {
  useEffect(() => {
    if (attachedContext.length === 0) return;
    const timer = window.setTimeout(() => {
      textInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [attachedContext.length]);
}

interface UseOverlayFx16Deps {
  reportShellSize: any;
}

export function useOverlayFx16({
  reportShellSize,
}: UseOverlayFx16Deps) {
  useEffect(() => {
    const timer = setTimeout(reportShellSize, 600);
    return () => clearTimeout(timer);
  }, [reportShellSize]);
}

interface UseOverlayFx17Deps {
  checkCodeVisibility: any;
  messages: any[];
}

export function useOverlayFx17({
  checkCodeVisibility,
  messages,
}: UseOverlayFx17Deps) {
  useEffect(() => {
    const raf = requestAnimationFrame(() => checkCodeVisibility());
    return () => cancelAnimationFrame(raf);
  }, [messages, checkCodeVisibility]);
}

interface UseOverlayFx18Deps {
  messages: any[];
  setConversationContext: Setter;
}

export function useOverlayFx18({
  messages,
  setConversationContext,
}: UseOverlayFx18Deps) {
  useEffect(() => {
    const context = messages
      .filter((m) => m.role !== "user" || !m.hasScreenshot)
      .map(
        (m) =>
          `${m.role === "interviewer" ? "Interviewer" : m.role === "user" ? "User" : "Assistant"}: ${m.text}`,
      )
      .slice(-20)
      .join("\n");
    setConversationContext(context);
  }, [messages]);
}

interface UseOverlayFx19Deps {
  setIsSettingsOpen: Setter;
}

export function useOverlayFx19({
  setIsSettingsOpen,
}: UseOverlayFx19Deps) {
  useEffect(() => {
    if (!window.electronAPI?.onSettingsVisibilityChange) return;
    const unsubscribe = window.electronAPI.onSettingsVisibilityChange(
      (isVisible) => {
        setIsSettingsOpen(isVisible);
      },
    );
    return () => unsubscribe();
  }, []);
}

interface UseOverlayFx20Deps {
  isExpanded: any;
  isStealthRef: Ref;
}

export function useOverlayFx20({
  isExpanded,
  isStealthRef,
}: UseOverlayFx20Deps) {
  useEffect(() => {
    if (isExpanded) {
      window.electronAPI.showWindow(isStealthRef.current);
      isStealthRef.current = false; // Reset back to default
    } else {
      // Slight delay to allow animation to clean up if needed, though immediate is safer for click-through
      // Using setTimeout to ensure the render cycle completes first
      // Increased to 400ms to allow "contract to bottom" exit animation to finish
      setTimeout(() => window.electronAPI.hideWindow(), 400);
    }
  }, [isExpanded]);
}

interface UseOverlayFx21Deps {
  setIsExpanded: Setter;
}

export function useOverlayFx21({
  setIsExpanded,
}: UseOverlayFx21Deps) {
  useEffect(() => {
    if (!window.electronAPI?.onToggleExpand) return;
    const unsubscribe = window.electronAPI.onToggleExpand(() => {
      setIsExpanded((prev) => !prev);
    });
    return () => unsubscribe();
  }, []);
}

interface UseOverlayFx22Deps {
  isStealthRef: Ref;
  setIsExpanded: Setter;
}

export function useOverlayFx22({
  isStealthRef,
  setIsExpanded,
}: UseOverlayFx22Deps) {
  useEffect(() => {
    if (!window.electronAPI?.onEnsureExpanded) return;
    const unsubscribe = window.electronAPI.onEnsureExpanded(() => {
      isStealthRef.current = true;
      setIsExpanded(true);
    });
    return () => unsubscribe();
  }, []);
}

interface UseOverlayFx23Deps {
  handleScreenshotAttach: any;
}

export function useOverlayFx23({
  handleScreenshotAttach,
}: UseOverlayFx23Deps) {
  useEffect(() => {
    const cleanupTaken = window.electronAPI.onScreenshotTaken(
      handleScreenshotAttach,
    );
    const cleanupAttached = window.electronAPI.onScreenshotAttached?.(
      handleScreenshotAttach,
    );
    return () => {
      cleanupTaken?.();
      cleanupAttached?.();
    };
  }, []);
}

interface UseOverlayFx24Deps {
  isProcessing: any;
  isProcessingRef: Ref;
}

export function useOverlayFx24({
  isProcessing,
  isProcessingRef,
}: UseOverlayFx24Deps) {
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);
}

interface UseOverlayFx25Deps {
  applyActiveListeningOnMeetingStartRef: Ref;
  refreshProfileListeningRefs: any;
}

export function useOverlayFx25({
  applyActiveListeningOnMeetingStartRef,
  refreshProfileListeningRefs,
}: UseOverlayFx25Deps) {
  useEffect(() => {
    if (!window.electronAPI?.onSessionReset) return;
    const unsubscribe = window.electronAPI.onSessionReset(() => {
      refreshProfileListeningRefs();
      window.setTimeout(() => {
        void applyActiveListeningOnMeetingStartRef.current?.();
      }, 200);
    });
    return () => unsubscribe();
  }, [refreshProfileListeningRefs]);
}

interface UseOverlayFx26Deps {
  setStealthHotkeyConflict: Setter;
}

export function useOverlayFx26({
  setStealthHotkeyConflict,
}: UseOverlayFx26Deps) {
  useEffect(() => {
    if (!window.electronAPI?.onKeybindRegistrationFailed) return;
    const unsubscribe = window.electronAPI.onKeybindRegistrationFailed(
      ({ id, accelerator }) => {
        if (id !== "chat:focusInput") return;
        setStealthHotkeyConflict(accelerator);
      },
    );
    return unsubscribe;
  }, []);
}

interface UseOverlayFx27Deps {
}

export function useOverlayFx27({
}: UseOverlayFx27Deps) {
  useEffect(() => {
    if (!window.electronAPI?.modelSelectorCloseIfOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-model-selector-toggle="true"]')) return;
      window.electronAPI.modelSelectorCloseIfOpen().catch(() => {});
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);
}
