import React, { useEffect } from "react";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface Deps {
  stealthTapAvailableRef: Ref;
  stealthAutoEngageOkRef: Ref;
  stealthTapActiveRef: Ref;
}

/** Auto-engage stealth tap on mousedown over [data-stealth-engage]. Verbatim. Relocated (deps array unchanged). */
export function useStealthAutoEngage({
  stealthTapAvailableRef,
  stealthAutoEngageOkRef,
  stealthTapActiveRef,
}: Deps) {
  useEffect(() => {
    if (!window.electronAPI?.stealthTapStart) return;

    window.electronAPI
      .stealthTapAvailable?.()
      .then((ok) => {
        stealthTapAvailableRef.current = !!ok;
      })
      .catch(() => {
        stealthTapAvailableRef.current = false;
      });

    // Resolve the IME-safety policy once at mount. While the promise is in
    // flight we keep the default (true) so users on plain ASCII layouts
    // see no behaviour change. The probe runs on the main process via
    // `defaults read com.apple.HIToolbox`; see electron/services/
    // ImeDetector.ts for the reason this gate exists at all.
    if (window.electronAPI.stealthTapShouldAutoEngage) {
      window.electronAPI
        .stealthTapShouldAutoEngage()
        .then((ok) => {
          stealthAutoEngageOkRef.current = !!ok;
        })
        .catch(() => {
          /* fail open — keep default */
        });
    }

    const onMouseDown = (e: MouseEvent) => {
      if (stealthTapActiveRef.current) return; // already on
      if (!stealthTapAvailableRef.current) return;
      // IME present → never auto-engage. The user can still press the
      // explicit hotkey if they want true OS-level invisible typing
      // (they'll lose composition in that path by design).
      if (!stealthAutoEngageOkRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.('[data-stealth-engage="true"]')) return;
      window.electronAPI.stealthTapStart().catch(() => {});
    };

    document.addEventListener("mousedown", onMouseDown, true); // capture phase
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, []);
}
