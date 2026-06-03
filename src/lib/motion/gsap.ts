import { gsap } from "gsap";

export type PressOptions = {
  scale?: number;
  duration?: number;
  ease?: string;
};

/**
 * Subtle Linear-style press microinteraction.
 * Intended for buttons/cards. Call on pointer down/up.
 */
export function pressDown(el: Element | null, opts: PressOptions = {}) {
  if (!el) return;
  const { scale = 0.98, duration = 0.12, ease = "power2.out" } = opts;
  gsap.to(el, { scale, duration, ease, overwrite: "auto" });
}

export function pressUp(el: Element | null, opts: PressOptions = {}) {
  if (!el) return;
  const { duration = 0.14, ease = "power2.out" } = opts;
  gsap.to(el, { scale: 1, duration, ease, overwrite: "auto" });
}

export type ExpandCollapseOptions = {
  duration?: number;
  ease?: string;
};

export function expand(el: HTMLElement | null, opts: ExpandCollapseOptions = {}) {
  if (!el) return;
  const { duration = 0.18, ease = "power2.out" } = opts;
  el.style.overflow = "hidden";
  const h = el.scrollHeight;
  gsap.fromTo(el, { height: 0, opacity: 0.7 }, { height: h, opacity: 1, duration, ease, overwrite: "auto" });
}

export function collapse(el: HTMLElement | null, opts: ExpandCollapseOptions = {}) {
  if (!el) return;
  const { duration = 0.16, ease = "power2.inOut" } = opts;
  el.style.overflow = "hidden";
  gsap.to(el, { height: 0, opacity: 0.7, duration, ease, overwrite: "auto" });
}

