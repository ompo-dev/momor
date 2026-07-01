import { useEffect, useRef } from "react";

interface Deps {
  isShortcutPressed: (e: KeyboardEvent, action: any) => boolean;
  isProcessing: boolean;
  isMousePassthrough: boolean;
  setIsProcessing: (v: boolean) => void;
  setMessages: (v: any) => void;
  setAttachedContext: (v: any) => void;
  setInputValue: (v: string) => void;
  setIsMousePassthrough: (v: boolean) => void;
  handleWhatToSay: () => void;
  handleScreenshotAttach: (data: { path: string; preview: string }) => void;
}

/**
 * General rebindable global shortcuts handled renderer-side when focused
 * (toggle visibility / process screenshots / reset-cancel / screenshot /
 * selective screenshot / mouse passthrough). Verbatim relocation from
 * MomorInterface — the handler ref is rebuilt every render so the keydown
 * listener (bound once on isShortcutPressed) always sees fresh state.
 */
export function useOverlayGeneralShortcuts({
  isShortcutPressed,
  isProcessing,
  isMousePassthrough,
  setIsProcessing,
  setMessages,
  setAttachedContext,
  setInputValue,
  setIsMousePassthrough,
  handleWhatToSay,
  handleScreenshotAttach,
}: Deps) {
  const buildHandlers = () => ({
    toggleVisibility: () => window.electronAPI.toggleWindow(),
    processScreenshots: handleWhatToSay,
    resetCancel: async () => {
      if (isProcessing) {
        setIsProcessing(false);
      } else {
        await window.electronAPI.resetIntelligence();
        setMessages([]);
        setAttachedContext([]);
        setInputValue("");
      }
    },
    toggleMousePassthrough: () => {
      const newState = !isMousePassthrough;
      setIsMousePassthrough(newState);
      window.electronAPI?.setOverlayMousePassthrough?.(newState);
    },
    takeScreenshot: async () => {
      try {
        const data = await window.electronAPI.takeScreenshot();
        if (data && data.path) {
          handleScreenshotAttach(data as { path: string; preview: string });
        }
      } catch (err) {
        console.error("Error triggering screenshot:", err);
      }
    },
    selectiveScreenshot: async () => {
      try {
        const data = await window.electronAPI.takeSelectiveScreenshot();
        if (data && !data.cancelled && data.path) {
          handleScreenshotAttach(data as { path: string; preview: string });
        }
      } catch (err) {
        console.error("Error triggering selective screenshot:", err);
      }
    },
  });

  const generalHandlersRef = useRef(buildHandlers());
  // Update ref every render so the listener always accesses latest state/props.
  generalHandlersRef.current = buildHandlers();

  useEffect(() => {
    const handleGeneralKeyDown = (e: KeyboardEvent) => {
      const handlers = generalHandlersRef.current;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isShortcutPressed(e, "toggleVisibility")) {
        e.preventDefault();
        handlers.toggleVisibility();
      } else if (isShortcutPressed(e, "processScreenshots")) {
        if (!isInput) {
          e.preventDefault();
          handlers.processScreenshots();
        }
      } else if (isShortcutPressed(e, "resetCancel")) {
        e.preventDefault();
        handlers.resetCancel();
      } else if (isShortcutPressed(e, "takeScreenshot")) {
        e.preventDefault();
        handlers.takeScreenshot();
      } else if (isShortcutPressed(e, "selectiveScreenshot")) {
        e.preventDefault();
        handlers.selectiveScreenshot();
      } else if (isShortcutPressed(e, "toggleMousePassthrough")) {
        e.preventDefault();
        handlers.toggleMousePassthrough();
      }
    };

    window.addEventListener("keydown", handleGeneralKeyDown);
    return () => window.removeEventListener("keydown", handleGeneralKeyDown);
  }, [isShortcutPressed]);

  // Exposed so the stealth global-shortcut handler can reuse the same handlers.
  return generalHandlersRef;
}
