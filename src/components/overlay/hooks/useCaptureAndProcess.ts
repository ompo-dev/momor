import React, { useEffect } from "react";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface Deps {
  setIsExpanded: Setter;
  pendingCaptureRef: Ref;
  setAttachedContext: Setter;
  handlersRef: Ref;
}

/** capture-and-process: attach screenshot + trigger analysis. Verbatim. Relocated (deps array unchanged). */
export function useCaptureAndProcess({
  setIsExpanded,
  pendingCaptureRef,
  setAttachedContext,
  handlersRef,
}: Deps) {
  useEffect(() => {
    if (!window.electronAPI.onCaptureAndProcess) return;
    const unsubscribe = window.electronAPI.onCaptureAndProcess((data) => {
      setIsExpanded(true);

      // Store screenshot in a stable ref BEFORE updating React state.
      // This fixes the React 18 concurrent mode timing race where setTimeout(0)
      // could fire before setAttachedContext had flushed, leaving handleWhatToSay
      // with an empty attachedContext and causing silent failures.
      pendingCaptureRef.current = data;

      setAttachedContext((prev) => {
        if (prev.some((s: any) => s.path === data.path)) return prev;
        return [...prev, data].slice(-5);
      });

      // Use requestAnimationFrame so we wait for at least one paint cycle —
      // more reliable than setTimeout(0) under React 18 concurrent scheduling.
      // The ref guarantees handleWhatToSay has the screenshot regardless of
      // whether the state update has flushed yet.
      requestAnimationFrame(() => {
        try {
          handlersRef.current.handleWhatToSay();
        } finally {
          pendingCaptureRef.current = null;
        }
      });
    });
    return unsubscribe;
  }, []);
}
