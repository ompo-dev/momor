import React, { useEffect } from "react";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface Deps {
  stealthTapActiveRef: Ref;
  isStealthRef: Ref;
  handleManualSubmitRef: Ref;
  setStealthTapActive: Setter;
  setIsExpanded: Setter;
  setStealthPermissionMissing: Setter;
  setInputValue: Setter;
}

// HID virtual keycodes referenced below (stable across layouts):
//   36 = Return,  48 = Tab,  51 = Delete (Backspace),  53 = Esc,
//   76 = Numpad Enter,  123 = Left,  124 = Right,  125 = Down,  126 = Up.
/** Stealth CGEventTap: capture keystrokes without window focus. Verbatim relocation (deps array unchanged). */
export function useStealthTap({
  stealthTapActiveRef,
  isStealthRef,
  handleManualSubmitRef,
  setStealthTapActive,
  setIsExpanded,
  setStealthPermissionMissing,
  setInputValue,
}: Deps) {
  useEffect(() => {
    if (
      !window.electronAPI?.onStealthTapState ||
      !window.electronAPI?.onStealthKeyCaptured
    )
      return;

    // Effect-scoped flag set when Esc is observed in the captured-key
    // stream. Suppresses non-Esc events that may have been queued by the
    // worker thread before the user pressed Esc. Cleared on each new
    // active=true state event (a new tap session). Hoisted here so both
    // listeners see the same binding.
    let escSuppressUntilNextActive = false;

    const unsubState = window.electronAPI.onStealthTapState(
      ({ active, reason }) => {
        stealthTapActiveRef.current = active;
        setStealthTapActive(active);
        if (active) {
          // Auto-expand the overlay so the user can see what they're
          // typing. We do NOT call .focus() — the whole point of the
          // tap is to avoid window-level focus.
          isStealthRef.current = true;
          setIsExpanded(true);
          setStealthPermissionMissing(false);
          escSuppressUntilNextActive = false;
        }
        if (!active && reason === "permission") {
          setStealthPermissionMissing(true);
        }
      },
    );

    const unsubKey = window.electronAPI.onStealthKeyCaptured((ev) => {
      // CONTRACT WITH RUST: keyboard_tap.rs pass-through filter (R3)
      // returns the event unmodified for ANY system-modifier key
      // (Cmd / Ctrl / Option / Fn) and for ALL F-keys, so the OS
      // routes those normally to the foreground app. Consequence:
      // (ev.flags & CMD) is NEVER true here, neither is OPT or CTRL.
      // The previous round had Cmd+Enter / Cmd+Backspace / Cmd+A /
      // Option+Backspace branches — all dead code under R3. Removed
      // to prevent a false sense of feature support; if Rust ever
      // changes the filter to deliver Cmd events, those branches
      // need to be REINTRODUCED with explicit testing, not
      // resurrected from a TODO.

      // Esc handled regardless of active state (main process broadcasts
      // it BEFORE stopping the tap, so we get here while still active;
      // see StealthKeyboardManager.handleCapturedKey ordering).
      if (ev.isKeyDown && ev.keyCode === 53) {
        setInputValue("");
        escSuppressUntilNextActive = true;
        return;
      }

      // Belt-and-braces clear of the Esc-suppress flag on the first
      // key event of a new session. State and captured-key arrive on
      // separate IPC channels and ordering across channels is NOT
      // guaranteed — if the first keystroke of a new session arrives
      // before the state-active broadcast, the suppress flag (set by
      // a prior Esc) would still be true and the keystroke would be
      // dropped. We re-check the ref (which the state listener flips
      // synchronously on receipt): if the ref is now true, this is a
      // legitimate new-session keystroke → clear suppress and proceed.
      if (escSuppressUntilNextActive && stealthTapActiveRef.current) {
        console.warn(
          "[stealth] cross-channel race resolved by ref check — captured-key arrived before state event",
        );
        escSuppressUntilNextActive = false;
      }
      if (escSuppressUntilNextActive) return; // drop late-arriving keys after Esc
      if (!stealthTapActiveRef.current) return; // ignore other events after stop
      if (!ev.isKeyDown) return; // we only act on keyDown

      switch (ev.keyCode) {
        case 36: // Return
        case 76: // Numpad Enter
          handleManualSubmitRef.current();
          window.electronAPI.stealthTapStop().catch(() => {});
          return;
        case 51: // Backspace — delete one char
          setInputValue((prev) => prev.slice(0, -1));
          return;
        // ROUND 4 FIX (#6): Tab (48) and arrows (123-126) used to
        // be no-op'd here. They're now passed through at the Rust
        // layer (keyboard_tap.rs F-key whitelist) so they reach the
        // user's foreground app normally. Removing the dead cases
        // keeps the contract honest: this switch only sees text-
        // worthy keys + Backspace + Enter. If anyone ever changes
        // the Rust filter to deliver Tab again, decide explicitly
        // what it should do here rather than copy-pasting a no-op.
      }

      // Append printable chars. CGEventKeyboardGetUnicodeString already
      // honors the active layout, dead keys, and IME — we don't need to
      // re-derive characters from keyCode + modifiers ourselves. Filter
      // shift-only modifier (it's already encoded in the chars).
      if (
        ev.chars &&
        ev.chars.length > 0 &&
        ev.chars !== "\r" &&
        ev.chars !== "\n" &&
        ev.chars !== "\t"
      ) {
        setInputValue((prev) => prev + ev.chars);
      }
    });

    return () => {
      unsubState();
      unsubKey();
    };
  }, []);
}
