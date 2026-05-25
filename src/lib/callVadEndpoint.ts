/**
 * Energy-based endpointing for voice turns (short / medium / long pauses).
 * Ported from OpenCode session call VAD (packages/app/src/pages/session/call.ts).
 */

export type CallVadLabel = "idle" | "speech" | "short" | "medium" | "long";

export interface CallVadConfig {
  /** Noise floor baseline (RMS). */
  call_floor?: number;
  /** 0.5–2 — higher reacts to quieter speech sooner. */
  call_sensitivity?: number;
  short_pause_ms?: number;
  medium_pause_ms?: number;
  long_pause_ms?: number;
}

export interface CallVadFrame {
  peak: number;
  rms: number;
  chunk_ms: number;
}

const DEFAULTS: Required<CallVadConfig> = {
  call_floor: 0.004,
  call_sensitivity: 1,
  short_pause_ms: 600,
  medium_pause_ms: 2000,
  long_pause_ms: 3500,
};

/** Shared pause profile for Answer-in-call (browser VAD + STT silence). */
export const ANSWER_CALL_PAUSE_DEFAULTS: CallVadConfig = {
  short_pause_ms: DEFAULTS.short_pause_ms,
  medium_pause_ms: DEFAULTS.medium_pause_ms,
  long_pause_ms: DEFAULTS.long_pause_ms,
};

export function getAnswerCallEndpointPauseMs(): number {
  return ANSWER_CALL_PAUSE_DEFAULTS.medium_pause_ms ?? DEFAULTS.medium_pause_ms;
}

export class CallVadEndpoint {
  private floor: number;
  private gate = 0;
  private quiet = 0;
  private talk = false;
  private vad: CallVadLabel = "idle";
  private readonly cfg: Required<CallVadConfig>;

  constructor(config?: CallVadConfig) {
    this.cfg = { ...DEFAULTS, ...config };
    this.floor = this.cfg.call_floor;
  }

  get state(): CallVadLabel {
    return this.vad;
  }

  reset(): void {
    this.floor = this.cfg.call_floor;
    this.gate = 0;
    this.quiet = 0;
    this.talk = false;
    this.vad = "idle";
  }

  /**
   * Feed one audio analysis frame. Returns true when a user turn should end
   * (medium or long pause after speech).
   */
  processFrame(next: CallVadFrame): boolean {
    const sense = Math.max(0.5, Math.min(2, this.cfg.call_sensitivity));
    const base = Math.max(0.001, this.cfg.call_floor);
    const value = Math.max(next.rms, next.peak * 0.7);

    if (!this.talk && value < this.floor * 1.5) {
      this.floor = Math.max(base, this.floor * 0.995 + value * 0.005);
    }

    const limit = Math.max(base * 1.15, this.floor * (2.2 / sense));
    const hit = value > limit;

    if (hit) {
      this.gate += next.chunk_ms;
      this.quiet = 0;
      if (this.vad !== "speech") this.vad = "speech";
      if (!this.talk && this.gate >= 40) {
        this.talk = true;
      }
      return false;
    }

    this.gate = 0;
    if (!this.talk) {
      if (this.vad !== "idle") this.vad = "idle";
      return false;
    }

    this.quiet += next.chunk_ms;

    if (this.quiet >= this.cfg.long_pause_ms) {
      if (this.vad !== "long") this.vad = "long";
      this.reset();
      return true;
    }
    if (this.quiet >= this.cfg.medium_pause_ms) {
      if (this.vad !== "medium" && this.vad !== "long") this.vad = "medium";
      this.reset();
      return true;
    }
    if (this.quiet >= this.cfg.short_pause_ms) {
      if (this.vad !== "short" && this.vad !== "medium" && this.vad !== "long") {
        this.vad = "short";
      }
    }
    return false;
  }
}
