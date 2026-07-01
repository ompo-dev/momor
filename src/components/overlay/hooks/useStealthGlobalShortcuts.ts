import React, { useEffect } from "react";

interface Deps {
  handlersRef: React.MutableRefObject<any>;
  generalHandlersRef: React.MutableRefObject<any>;
  isStealthRef: React.MutableRefObject<boolean>;
  actionButtonMode: string;
  inertialScrollRef: React.MutableRefObject<any>;
  setIsExpanded: (v: boolean) => void;
  textInputRef: React.RefObject<HTMLInputElement | null>;
}

/** Global (background) shortcut handler — fires quick-actions while blurred. Verbatim. */
export function useStealthGlobalShortcuts({
  handlersRef,
  generalHandlersRef,
  isStealthRef,
  actionButtonMode,
  inertialScrollRef,
  setIsExpanded,
  textInputRef,
}: Deps) {
  useEffect(() => {
    if (!window.electronAPI.onGlobalShortcut) return;
    const unsubscribe = window.electronAPI.onGlobalShortcut(({ action }) => {
      const handlers = handlersRef.current;
      const generalHandlers = generalHandlersRef.current;

      isStealthRef.current = true;

      if (action === "whatToAnswer") handlers.handleWhatToSay();
      else if (action === "shorten") handlers.handleFollowUp("shorten");
      else if (action === "followUp") handlers.handleFollowUpQuestions();
      else if (action === "recap") handlers.handleRecap();
      else if (action === "dynamicAction4") {
        if (actionButtonMode === "brainstorm") handlers.handleBrainstorm();
        else handlers.handleRecap();
      } else if (action === "answer") handlers.handleAnswerNow();
      else if (action === "clarify") handlers.handleClarify();
      else if (action === "codeHint") handlers.handleCodeHint();
      else if (action === "brainstorm") handlers.handleBrainstorm();
      else if (action === "scrollUp")
        inertialScrollRef.current?.kick("vert", -1);
      else if (action === "scrollDown")
        inertialScrollRef.current?.kick("vert", 1);
      else if (action === "scrollLeft")
        inertialScrollRef.current?.kick("horiz", -1);
      else if (action === "scrollRight")
        inertialScrollRef.current?.kick("horiz", 1);
      else if (action === "focusInput") {
        // Stealth-focus the chat input: the panel-type overlay (macOS) is
        // already key without activating the app. We just need the input
        // element to be the active DOM target so keystrokes land in it.
        // Defer to next frame so an expand-from-collapsed has time to
        // mount the input before .focus() runs.
        setIsExpanded(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => textInputRef.current?.focus());
        });
      } else if (action === "processScreenshots")
        generalHandlers.processScreenshots();
      else if (action === "resetCancel") generalHandlers.resetCancel();
      else if (action === "takeScreenshot") generalHandlers.takeScreenshot();
      else if (action === "selectiveScreenshot")
        generalHandlers.selectiveScreenshot();

      // Safety reset if it didn't trigger an expansion
      setTimeout(() => {
        isStealthRef.current = false;
      }, 500);
    });
    return unsubscribe;
  }, []);
}
