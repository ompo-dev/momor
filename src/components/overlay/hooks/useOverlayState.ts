import { useRef } from "react";
import { animate } from "framer-motion";
import { useOverlayStore } from "../../../stores/overlayStore";

/**
 * Returns the overlay state. Reactive state now lives in the Zustand
 * `useOverlayStore` (no longer prop-drilled); this hook only owns the
 * imperative refs and spreads the store so the existing call sites keep
 * working. Components should prefer reading the store directly via
 * `useOverlayStore(s => s.x)` instead of receiving these as props.
 */
export function useOverlayState() {
  const store = useOverlayStore();

  const isCollapsedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const manualTranscriptRef = useRef<string>("");
  const answerSttLastActivityRef = useRef(0);
  const answerSttHadSpeechRef = useRef(false);
  const answerAutoFinishRef = useRef(false);
  const answerCallSessionActiveRef = useRef(false);
  const activeListeningEnabledRef = useRef(false);
  const autoSuggestEnabledRef = useRef(false);
  const lastAutoSuggestAtRef = useRef(0);
  const isProcessingRef = useRef(false);
  const applyActiveListeningOnMeetingStartRef = useRef<
    (() => Promise<void>) | null
  >(null);
  const handleWhatToSayRef = useRef<
    (
      promptInstruction?: string | React.MouseEvent,
      options?: { question?: string },
    ) => Promise<void>
  >(async () => {});
  const handleAnswerNowRef = useRef<(() => Promise<void>) | null>(null);
  const finishAnswerNowTurnRef = useRef<
    ((resumeAfter?: boolean) => Promise<void>) | null
  >(null);
  const startAnswerNowListeningRef = useRef<(() => Promise<void>) | null>(null);
  const resumeAnswerCallListeningRef = useRef<(() => Promise<void>) | null>(
    null,
  );
  const requestStartTimeRef = useRef<number | null>(null);
  const rollingLiveRef = useRef("");
  const userRollingLiveRef = useRef("");
  const voiceInputRef = useRef<string>("");
  const textInputRef = useRef<HTMLInputElement>(null);
  const isStealthRef = useRef<boolean>(false);
  const stealthTapActiveRef = useRef<boolean>(false);
  const stealthTapAvailableRef = useRef<boolean>(false);
  const stealthAutoEngageOkRef = useRef<boolean>(true);
  const handleManualSubmitRef = useRef<() => void>(() => {});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rafDimUpdateRef = useRef<number | null>(null);
  const codeExpandedRef = useRef(false);
  const animationControlsRef = useRef<ReturnType<typeof animate> | null>(null);
  const stableVisibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingVisibilityRef = useRef<boolean | null>(null);
  const wasAtBottomRef = useRef<boolean>(true);
  const pendingCaptureRef = useRef<{ path: string; preview: string } | null>(
    null,
  );
  const isExpandedRef = useRef(true);
  const tokenBufRef = useRef<{
    intent: string;
    text: string;
    raf: number | null;
  }>({ intent: "", text: "", raf: null });
  const inertialScrollRef = useRef<{
    kick: (axis: "vert" | "horiz", direction: -1 | 1) => void;
  } | null>(null);

  return {
    ...store,
    isCollapsedRef,
    isRecordingRef,
    manualTranscriptRef,
    answerSttLastActivityRef,
    answerSttHadSpeechRef,
    answerAutoFinishRef,
    answerCallSessionActiveRef,
    activeListeningEnabledRef,
    autoSuggestEnabledRef,
    lastAutoSuggestAtRef,
    isProcessingRef,
    applyActiveListeningOnMeetingStartRef,
    handleWhatToSayRef,
    handleAnswerNowRef,
    finishAnswerNowTurnRef,
    startAnswerNowListeningRef,
    resumeAnswerCallListeningRef,
    requestStartTimeRef,
    rollingLiveRef,
    userRollingLiveRef,
    voiceInputRef,
    textInputRef,
    isStealthRef,
    stealthTapActiveRef,
    stealthTapAvailableRef,
    stealthAutoEngageOkRef,
    handleManualSubmitRef,
    messagesEndRef,
    contentRef,
    scrollContainerRef,
    rafDimUpdateRef,
    codeExpandedRef,
    animationControlsRef,
    stableVisibilityTimerRef,
    pendingVisibilityRef,
    wasAtBottomRef,
    pendingCaptureRef,
    isExpandedRef,
    tokenBufRef,
    inertialScrollRef,
  };
}
