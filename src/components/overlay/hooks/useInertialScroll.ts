import React, { useEffect } from "react";

type Ref = React.MutableRefObject<any>;

/** Inertial (momentum) scroll engine exposed via inertialScrollRef.kick(). Verbatim relocation (deps array unchanged). */
export function useInertialScroll({
  scrollContainerRef,
  inertialScrollRef,
}: {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  inertialScrollRef: Ref;
}) {
  useEffect(() => {
    const KICK_VELOCITY = 900; // px/s added per press
    const TERMINAL_VELOCITY = 3200; // px/s clamp
    const FRICTION_HALF_LIFE = 0.16; // seconds for velocity to halve
    const MIN_VELOCITY = 8; // px/s — snap to zero below
    const MAX_FRAME_DT = 0.05; // clamp for tab-throttle hiccups

    const state = {
      raf: null as number | null,
      lastTs: 0,
      vert: { vel: 0, target: null as HTMLElement | null, frac: 0 },
      horiz: { vel: 0, target: null as HTMLElement | null, frac: 0 },
    };

    const resolveHorizontalTarget = (
      container: HTMLElement,
    ): HTMLElement | null => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = (containerRect.top + containerRect.bottom) / 2;

      const preElements = container.querySelectorAll("pre");
      let best: HTMLElement | null = null;
      let bestDistance = Infinity;

      preElements.forEach((pre) => {
        // Walk up from <pre> until we find the actual horizontal scroller.
        // Markdown renderers often wrap <pre> in a div that holds overflow-x.
        let scroller: HTMLElement | null = pre as HTMLElement;
        while (scroller && scroller !== container) {
          if (scroller.scrollWidth > scroller.clientWidth + 1) break;
          scroller = scroller.parentElement;
        }
        if (!scroller || scroller === container) return;
        if (scroller.scrollWidth <= scroller.clientWidth + 1) return;

        const rect = scroller.getBoundingClientRect();
        if (rect.bottom < containerRect.top || rect.top > containerRect.bottom)
          return;

        const distance = Math.abs(
          (rect.top + rect.bottom) / 2 - containerCenter,
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          best = scroller;
        }
      });

      return best;
    };

    const tick = (ts: number) => {
      if (state.lastTs === 0) state.lastTs = ts;
      const dt = Math.min((ts - state.lastTs) / 1000, MAX_FRAME_DT);
      state.lastTs = ts;
      const decay = Math.pow(0.5, dt / FRICTION_HALF_LIFE);

      const stepAxis = (axis: "vert" | "horiz") => {
        const a = state[axis];
        if (Math.abs(a.vel) < MIN_VELOCITY || !a.target) {
          a.vel = 0;
          a.frac = 0;
          a.target = null;
          return false;
        }
        const move = a.vel * dt + a.frac;
        const intMove = Math.trunc(move);
        a.frac = move - intMove;
        if (intMove !== 0) {
          if (axis === "vert") a.target.scrollTop += intMove;
          else a.target.scrollLeft += intMove;
        }
        a.vel *= decay;
        return true;
      };

      const vertActive = stepAxis("vert");
      const horizActive = stepAxis("horiz");

      if (vertActive || horizActive) {
        state.raf = requestAnimationFrame(tick);
      } else {
        state.raf = null;
        state.lastTs = 0;
      }
    };

    const kick = (axis: "vert" | "horiz", direction: -1 | 1) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      let target: HTMLElement | null;
      if (axis === "vert") {
        target = container;
      } else {
        target = resolveHorizontalTarget(container);
        // No visible scrollable code block → no-op rather than scrolling
        // an off-screen one or shaking the chat container sideways.
        if (!target) return;
      }

      const a = state[axis];
      // Reverse direction: reset rather than fight existing momentum.
      if (a.target !== target || Math.sign(a.vel) === -direction) {
        a.vel = 0;
        a.frac = 0;
      }
      a.target = target;
      const next = a.vel + direction * KICK_VELOCITY;
      a.vel = Math.max(-TERMINAL_VELOCITY, Math.min(TERMINAL_VELOCITY, next));

      if (state.raf === null) state.raf = requestAnimationFrame(tick);
    };

    inertialScrollRef.current = { kick };

    return () => {
      if (state.raf !== null) cancelAnimationFrame(state.raf);
      inertialScrollRef.current = null;
    };
  }, []);
}
