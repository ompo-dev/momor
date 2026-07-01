import React, { useEffect } from "react";

interface Deps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  handlersRef: React.MutableRefObject<any>;
  isShortcutPressed: (e: KeyboardEvent, action: any) => boolean;
  actionButtonMode: string;
}

/**
 * Frame-rate-independent momentum scroll + chat quick-action shortcuts.
 * Verbatim relocation from MomorInterface (same deps array, same closures).
 */
export function useOverlayScrollAndChatShortcuts({
  scrollContainerRef,
  handlersRef,
  isShortcutPressed,
  actionButtonMode,
}: Deps) {
  useEffect(() => {
    // ── Continuous, frame-rate-independent scroll with momentum ──
    // Velocity is integrated against real elapsed time so 60Hz, 120Hz, and
    // dropped-frame paths all produce the same physical speed. While a key
    // is held we ease velocity up to TERMINAL; on release we decay it
    // exponentially, which is what makes the stop feel weighted instead of
    // snapped. Sub-pixel motion is preserved via a fractional accumulator,
    // and we write `scrollTop` directly to bypass any browser scroll-behavior
    // smoothing that would fight the loop.
    const TERMINAL_VELOCITY = 1400; // px/s at full hold
    const ACCEL_SECONDS = 0.18; // time to reach terminal from rest
    const DECAY_HALF_LIFE = 0.09; // seconds for velocity to halve after release
    const DECAY_K = Math.LN2 / DECAY_HALF_LIFE;
    const MIN_VELOCITY = 6; // px/s — snap to 0 below this
    const MAX_FRAME_DT = 0.05; // clamp to absorb tab-throttle hiccups

    let direction: -1 | 0 | 1 = 0; // -1 up, 0 idle, 1 down (or both up+down → 0)
    let upHeld = false;
    let downHeld = false;
    let velocity = 0; // signed px/s
    let positionFraction = 0; // sub-pixel accumulator
    let lastTs = 0;
    let rafId: number | null = null;

    const recomputeDirection = () => {
      direction = upHeld === downHeld ? 0 : upHeld ? -1 : 1;
    };

    const tick = (ts: number) => {
      const container = scrollContainerRef.current;
      if (!container) {
        rafId = null;
        lastTs = 0;
        return;
      }
      if (lastTs === 0) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, MAX_FRAME_DT);
      lastTs = ts;

      if (direction !== 0) {
        const target = direction * TERMINAL_VELOCITY;
        const step = (TERMINAL_VELOCITY / ACCEL_SECONDS) * dt;
        if (Math.abs(target - velocity) <= step) velocity = target;
        else velocity += Math.sign(target - velocity) * step;
      } else {
        velocity *= Math.exp(-DECAY_K * dt);
        if (Math.abs(velocity) < MIN_VELOCITY) velocity = 0;
      }

      // Cache layout reads once per frame, then a single scrollTop write.
      const maxScroll = container.scrollHeight - container.clientHeight;
      const current = container.scrollTop;
      const move = velocity * dt + positionFraction;
      const intMove = Math.trunc(move);
      positionFraction = move - intMove;

      if (intMove !== 0) {
        let next = current + intMove;
        if (next <= 0) {
          next = 0;
          if (velocity < 0) {
            velocity = 0;
            positionFraction = 0;
          }
        } else if (next >= maxScroll) {
          next = maxScroll;
          if (velocity > 0) {
            velocity = 0;
            positionFraction = 0;
          }
        }
        if (next !== current) container.scrollTop = next;
      }

      if (direction !== 0 || velocity !== 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
        lastTs = 0;
        positionFraction = 0;
      }
    };

    const startScrollLoop = () => {
      if (rafId === null) rafId = requestAnimationFrame(tick);
    };
    const releaseScroll = () => {
      upHeld = false;
      downHeld = false;
      recomputeDirection();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        handleWhatToSay,
        handleFollowUp,
        handleFollowUpQuestions,
        handleRecap,
        handleAnswerNow,
        handleClarify,
        handleCodeHint,
        handleBrainstorm,
      } = handlersRef.current;

      // Chat Shortcuts (Scope: Local to Chat/Overlay usually, but we allow them here if focused)
      if (isShortcutPressed(e, "whatToAnswer")) {
        e.preventDefault();
        handleWhatToSay();
      } else if (isShortcutPressed(e, "clarify")) {
        e.preventDefault();
        handleClarify();
      } else if (isShortcutPressed(e, "followUp")) {
        e.preventDefault();
        handleFollowUpQuestions();
      } else if (isShortcutPressed(e, "dynamicAction4")) {
        e.preventDefault();
        if (actionButtonMode === "brainstorm") {
          handleBrainstorm();
        } else {
          handleRecap();
        }
      } else if (isShortcutPressed(e, "answer")) {
        e.preventDefault();
        handleAnswerNow();
      } else if (isShortcutPressed(e, "clarify")) {
        e.preventDefault();
        handleClarify();
      } else if (isShortcutPressed(e, "codeHint")) {
        e.preventDefault();
        handleCodeHint();
      } else if (isShortcutPressed(e, "brainstorm")) {
        e.preventDefault();
        handleBrainstorm();
      } else if (isShortcutPressed(e, "scrollUp")) {
        e.preventDefault();
        upHeld = true;
        recomputeDirection();
        startScrollLoop();
      } else if (isShortcutPressed(e, "scrollDown")) {
        e.preventDefault();
        downHeld = true;
        recomputeDirection();
        startScrollLoop();
      } else if (
        isShortcutPressed(e, "moveWindowUp") ||
        isShortcutPressed(e, "moveWindowDown")
      ) {
        // Prevent default scrolling when moving window
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Users typically lift the modifier (Cmd/Ctrl) first, so releasing
      // either it or the arrow ends the hold and lets momentum decay.
      if (e.key === "ArrowUp") {
        upHeld = false;
        recomputeDirection();
      } else if (e.key === "ArrowDown") {
        downHeld = false;
        recomputeDirection();
      } else if (e.key === "Meta" || e.key === "Control") {
        releaseScroll();
      }
    };

    // Window blur swallows keyup; reset to avoid stuck scrolling.
    const handleBlur = () => releaseScroll();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isShortcutPressed]);
}
