import React, {
  useState,
  useRef,
  useLayoutEffect,
  startTransition as reactStartTransition,
} from "react";
import { useMotionValue, useTransform } from "framer-motion";
import {
  oneLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useComposerMentions } from "./overlay/hooks/useComposerMentions";
import { useOverlayGeneralShortcuts } from "./overlay/hooks/useOverlayGeneralShortcuts";
import { useOverlayScrollAndChatShortcuts } from "./overlay/hooks/useOverlayScrollAndChatShortcuts";
import { useStealthGlobalShortcuts } from "./overlay/hooks/useStealthGlobalShortcuts";
import { useLiveMeetingListeners } from "./overlay/hooks/useLiveMeetingListeners";
import { useAgentStreamListeners } from "./overlay/hooks/useAgentStreamListeners";
import { useInertialScroll } from "./overlay/hooks/useInertialScroll";
import { useStealthTap } from "./overlay/hooks/useStealthTap";
import { useClarifyStream } from "./overlay/hooks/useClarifyStream";
import { useSessionReset } from "./overlay/hooks/useSessionReset";
import { useStealthAutoEngage } from "./overlay/hooks/useStealthAutoEngage";
import { useCaptureAndProcess } from "./overlay/hooks/useCaptureAndProcess";
import { useSttStatusListener } from "./overlay/hooks/useSttStatusListener";
import { useAgentToolChips } from "./overlay/hooks/useAgentToolChips";
import { useOverlayModeInit } from "./overlay/hooks/useOverlayModeInit";
import { useQuickActions } from "./overlay/hooks/useQuickActions";
import { useAnswerCall } from "./overlay/hooks/useAnswerCall";
import { useTokenBuffer } from "./overlay/hooks/useTokenBuffer";
import {
  useOverlayFx1,
  useOverlayFx2,
  useOverlayFx3,
  useOverlayFx4,
  useOverlayFx5,
  useOverlayFx6,
  useOverlayFx7,
  useOverlayFx8,
  useOverlayFx9,
  useOverlayFx10,
  useOverlayFx11,
  useOverlayFx12,
  useOverlayFx13,
  useOverlayFx14,
  useOverlayFx15,
  useOverlayFx16,
  useOverlayFx17,
  useOverlayFx18,
  useOverlayFx19,
  useOverlayFx20,
  useOverlayFx21,
  useOverlayFx22,
  useOverlayFx23,
  useOverlayFx24,
  useOverlayFx25,
  useOverlayFx26,
  useOverlayFx27,
} from "./overlay/hooks/useOverlayFx";
import {
  useDefaultModelLoader,
  useSttConfigListener,
  useScrollCodeVisibility,
  useOverlayUnmountCleanup,
  useUserContextSync,
  useAnswerEndpointWatcher,
} from "./overlay/hooks/useOverlayEffects";
import "katex/dist/katex.min.css";

import {
  analytics,
  detectProviderType,
} from "../lib/analytics/analytics.service";
import { useShortcuts } from "../hooks/useShortcuts";
import { useResolvedTheme } from "../hooks/useResolvedTheme";
import { OVERLAY_OPACITY_DEFAULT } from "../lib/overlayAppearance";
import { useTranslation } from "react-i18next";
import { getAnswerCallEndpointPauseMs } from "../lib/callVadEndpoint";
import {
  enrichSystemPromptWithUserContext,
  getActiveAiProfileId,
  loadUserSessionData,
  mergeConversationContextWithUserSession,
  USER_CONTEXT_CHANGED_EVENT,
} from "../lib/userSessionContext";
import { syncUserSessionContextToMain } from "../lib/syncUserSessionContextToMain";
import { commitRollingWithLive } from "../lib/rollingTranscript";
import {
  momorInterfaceProps,
  AUTO_SUGGEST_COOLDOWN_MS,
  hasInterviewerQuestionSignal,
  formatProviderLabel,
  isUserMicSpeaker,
  getSttSummary,
  getStatusToneClass,
} from "./momorShared";
import { useOverlayState } from "./overlay/hooks/useOverlayState";
import { useOverlayWiring } from "./overlay/hooks/useOverlayWiring";
import { useOverlayDerived } from "./overlay/hooks/useOverlayDerived";
import {
  use_handleSttProfileSelect,
  use_checkCodeVisibility,
  use_syncAnswerCallSession,
  use_refreshProfileListeningRefs,
  use_triggerAnswerNowEndpoint,
  use_handleModelSelect,
  use_refreshSttProfileUi,
  use_reportShellSize,
  use_startTransition,
  use_handleScreenshotAttach,
  use_clearChat,
  use_renderMessageText,
  use_blockInputFocus,
  use_copyDiagnostics,
} from "./overlay/hooks/useOverlayHandlers";

export function useMomorOverlay({
  onEndMeeting,
  overlayOpacity = OVERLAY_OPACITY_DEFAULT,
  interfaceTheme = "default",
}: momorInterfaceProps) {
  const state = useOverlayState();
  const { t } = useTranslation();
  const isLightTheme = useResolvedTheme() === "light";
  const isGlassTheme = interfaceTheme === "liquid-glass";
  const {
    mdComponents,
    appearance,
    rollingTranscriptPreview,
    userRollingTranscriptPreview,
  } = useOverlayDerived({
    overlayOpacity,
    isGlassTheme,
    isLightTheme,
    rollingCommitted: state.rollingCommitted,
    rollingLive: state.rollingLive,
    userRollingCommitted: state.userRollingCommitted,
    userRollingLive: state.userRollingLive,
  });
  const shellRef = React.useRef<HTMLDivElement>(null);
  // Collapsed = compact capsule widget (Hide button). Distinct from isExpanded,
  // which still controls full stealth hide/show via the global shortcut.
  const { shortcuts, isShortcutPressed } = useShortcuts();
  const [sttInterviewerProvider, setSttInterviewerProvider] =
    useState<string>("");
  // Agent tools used in the current turn (skills/MCP tools the CLI agent invoked).
  const [activeListeningSessionActive, setActiveListeningSessionActive] =
    useState(false);
  // Analytics State
  // Sync transcript setting

  // Sync auto-scroll setting

  // Auto-scroll to bottom on every messages update when toggle is enabled.
  // 'auto' (instant) instead of 'smooth' is intentional: streaming tokens fire
  // this effect tens of times per second; smooth would restart the animation
  // each time and never reach bottom, producing visible chase/jitter.

  const syncAnswerCallSession = use_syncAnswerCallSession({
    answerCallSessionActiveRef: state.answerCallSessionActiveRef,
    setAnswerCallSessionActive: state.setAnswerCallSessionActive,
  });
  const refreshProfileListeningRefs = use_refreshProfileListeningRefs({
    activeListeningEnabledRef: state.activeListeningEnabledRef,
    autoSuggestEnabledRef: state.autoSuggestEnabledRef,
    setActiveListeningSessionActive,
  });
  const triggerAnswerNowEndpoint = use_triggerAnswerNowEndpoint({
    answerAutoFinishRef: state.answerAutoFinishRef,
    finishAnswerNowTurnRef: state.finishAnswerNowTurnRef,
    isRecordingRef: state.isRecordingRef,
  });
  // STT silence endpointing while Answer is recording (meeting mic pipeline).

  // Overlay window = active call/meeting — call-mode UX is always on here,
  // independent of whether the interviewer transcript bar is visible.
  const isCallMode = true;

  // Composer "/" (skills) + "@" (mcps) autocomplete — state owned by a hook.
  const {
    mention,
    mentionItems,
    mentionIndex,
    setMention,
    setMentionIndex,
    onComposerChange,
    selectMention,
  } = useComposerMentions({
    inputValue: state.inputValue,
    setInputValue: state.setInputValue,
    inputRef: state.textInputRef,
  });
  // CGEventTap stealth-typing state. Driven by IPC from main; ref shadows
  // the state so the captured-key handler can early-out without depending
  // on React's render cycle for stop signals.
  // True when the click-to-engage stealth path is safe. False when an IME
  // (Pinyin / Hangul / Kanji / …) is enabled in macOS HIToolbox: the tap
  // captures below the IME so composition would never reach the chat box.
  // Resolved once on mount via IPC (default true so non-macOS / probe
  // failure falls back to existing behaviour).
  // Latest-handler ref so the captured-key listener (mounted with [] deps)
  // calls the CURRENT handleManualSubmit closure — not the one captured at
  // first render, which reads inputValue="" and silently no-ops on submit.
  // Updated on every render below.
  // Set when the user tried to engage the tap but Accessibility isn't
  // granted yet. Renders the inline permission banner so we never silently
  // fail — Cluely's onboarding is its UX moat; we mirror it.
  const [stealthPermissionMissing, setStealthPermissionMissing] =
    useState<boolean>(false);
  // Set when KeybindManager reports the stealth-typing global shortcut
  // failed to register (OS already owns it — common with Cmd+Shift+Space
  // if another app claimed it, or with the macOS input source switcher
  // in some configs). Stores the attempted accelerator so the banner can
  // tell the user exactly what conflicted.
  // Stability gate for code-visibility transitions. Scroll fires at ~60Hz;
  // without this, fast scrolls cancel and restart the 0.7s tween repeatedly,
  // producing stutter (and sometimes a snap when start≈target). The pending
  // visibility must hold its new state for STABILITY_MS before we commit to
  // a transition.
  // Sticky-bottom across expand/contract. Captured at the start of each
  // transition: if the chat was scrolled to (or within 8 px of) the bottom,
  // the rAF loop pins scrollTop to bottom on every spring frame so the
  // bottom of the conversation stays visually pinned as scrollMaxH grows.
  // iMessage does the same when its window resizes.
  // Captures data from onCaptureAndProcess before the React state flush so
  // handleWhatToSay() can access it even in React 18 concurrent mode (where
  // a plain setTimeout(0) may fire before setAttachedContext flushes).
  // Latent Context State (Screenshots attached but not sent)
  // Settings State with Persistence
  // Active mode name (shown as a badge near the Modes button)
  // Vision-first provenance — populated from the generateWhatToSay response.
  // Model Selection State
  // Dynamic Action Button Mode (Recap vs Brainstorm)

  const codeTheme = isLightTheme ? oneLight : vscDarkPlus;
  const codeLineNumberColor = isLightTheme
    ? "rgba(15,23,42,0.35)"
    : "rgba(255,255,255,0.2)";
  const overlayPanelClass = "overlay-text-primary";
  const subtleSurfaceClass = "overlay-subtle-surface";
  const codeBlockClass = "overlay-code-block-surface";
  const codeHeaderClass = "overlay-code-header-surface";
  const codeHeaderTextClass = "overlay-text-muted";
  const quickActionClass = "overlay-chip-surface overlay-text-interactive";
  const inputClass = `${isLightTheme ? "focus:ring-black/10" : "focus:ring-white/10"} overlay-input-surface overlay-input-text`;
  const controlSurfaceClass =
    "overlay-control-surface overlay-text-interactive";

  // PERF: hoist ReactMarkdown `components` maps for every streaming intent
  // into a single useMemo so their identity is stable across renders. Each
  // inline <ReactMarkdown components={{...}}> would create a fresh object
  // literal per render — defeating ReactMarkdown's internal render-bailout.
  //
  // ALL 6 message-intent branches stream tokens (per IntelligenceEngine emits):
  //   - standard:              plain system text bubbles (fallback render)
  //   - codeText:              text parts inside a code-bubble
  //   - whatToAnswerText:      `what_to_answer` card body (suggested_answer_token;
  //                            emerald theme)
  //   - recapText:             `recap` body (recap_token; indigo theme)
  //   - followUpQuestionsText: `follow_up_questions` body
  //                            (follow_up_questions_token; amber theme)
  //   - shortenText:           `shorten` body — IMPORTANT: shorten streams
  //                            via refined_answer_token with intent='shorten'
  //                            (IntelligenceEngine.ts:406, triggered by
  //                            handleFollowUp('shorten') at line 2657);
  //                            cyan theme.
  //
  // No intent is rendered with an inline `components={{...}}` literal.
  // ── Code-expansion spring ────────────────────────────────────────────────
  // Architecture: stable canvas, renderer-only animation.
  //
  // The OS window is pinned to STABLE_OVERLAY_WIDTH for the entire chat-
  // expanded session — its width never changes when code becomes visible or
  // hidden. The shell width animates 600 ↔ 780 purely in renderer CSS via a
  // Framer spring. mx-auto centers the shell against a STABLE 780 parent, so
  // its margin animates symmetrically (90 → 0 on expand, 0 → 90 on contract).
  //
  // Why this anchors the TopPill to its screen position:
  //   • OS window X never moves during code expand/contract (no IPC).
  //   • OS window content area is always 780 wide.
  //   • TopPill and shell sit in a flex column centered horizontally inside
  //     that stable canvas → TopPill's screen X is invariant of the spring.
  //   • OS window Y is preserved by setBounds → TopPill's screen Y is fixed.
  //   • Shell height growth is driven by content; ResizeObserver feeds height
  //     (only) to the OS, which extends downward (Y preserved).
  //
  // The 90px transparent gutters on each side when shellWidth == 600 are
  // invisible (window background is transparent) and click-through.
  const SHELL_WIDTH_COLLAPSED = 600;
  const SHELL_WIDTH_EXPANDED = 780;
  const STABLE_OVERLAY_WIDTH = SHELL_WIDTH_EXPANDED;
  const shellWidth = useMotionValue(SHELL_WIDTH_COLLAPSED);
  const scrollMaxH = useTransform(
    shellWidth,
    [SHELL_WIDTH_COLLAPSED, SHELL_WIDTH_EXPANDED],
    [320, 560],
  );

  // isExpanded mirror for closures inside refs/observers that must not
  // re-bind on every toggle.

  const handleModelSelect = use_handleModelSelect({ setCurrentModel: state.setCurrentModel });
  // Listen for default model changes from Settings

  // Global State Sync

  // Persist Settings

  // Mouse Passthrough State

  // Screen Recording Permission Warning Banner

  // Audio capture failure banner — surfaces specific Rust-side errors
  // (CoreAudio Tap failure, SCK timeout, no displays) and the stuck-watchdog
  // signal (capture started but no chunks for 8s, suggesting a routing
  // mismatch). Without this, users staring at an empty interviewer transcript
  // had no signal that anything was wrong.

  // PR #173: STT not configured warning — shown when provider is 'none' during a meeting
  const refreshSttProfileUi = use_refreshSttProfileUi({
    setCurrentSttLabel: state.setCurrentSttLabel,
    setCurrentSttProfileId: state.setCurrentSttProfileId,
    setSttNotConfigured: state.setSttNotConfigured,
  });
  const handleSttProfileSelect = use_handleSttProfileSelect({
    refreshSttProfileUi,
  });

  // Keep the closure-free isExpanded mirror in sync.

  // Mirror collapsed state + re-report size so the OS window shrinks to the
  // compact widget (instead of staying pinned to the expanded canvas width).

  // When fully hidden (stealth), drop the collapsed state so the next show
  // brings back the full panel rather than the compact widget.

  // Surface agent tool usage (skills / MCP tools the CLI agent invokes) as chips.

  // Clear tool chips at the start of each new turn.

  // Single canonical size-reporter. While the chat overlay is expanded we
  // pin the OS window to STABLE_OVERLAY_WIDTH (=SHELL_WIDTH_EXPANDED) so the
  // shell can spring 600↔780 in renderer CSS without ever resizing the OS
  // window — no IPC race, no clip, no jump. Centered IPC is used so the
  // first chat-mode entry (when the OS window may grow from a smaller mode
  // into the stable canvas) keeps the TopPill's center fixed; subsequent
  // height-only updates have widthDelta=0 and don't shift X.
  const reportShellSize = use_reportShellSize({
    STABLE_OVERLAY_WIDTH,
    contentRef: state.contentRef,
    isExpandedRef: state.isExpandedRef,
  });
  // ResizeObserver: rAF-debounced so the spring can update height without
  // flooding IPC. Width is constant in expanded mode, so per-frame updates
  // only carry height changes — no race with the renderer's CSS spring.

  // attachedContext (screenshots add/remove) and initial-sizing safety:
  // both just re-run the canonical reporter — no more "what width should I
  // use right now?" branching against animation flags.


  // ── Code-expansion ──────────────────────────────────────────────────────
  // The shell's width animates 600↔780 with a renderer-only spring against a
  // STABLE 780-wide OS canvas. mx-auto on the wrapper distributes the width
  // delta as symmetric horizontal margin → expansion grows from the center,
  // TopPill stays anchored, no IPC during the animation. Height growth is
  // picked up by the ResizeObserver and forwarded to the OS as height-only
  // updates (width is unchanged so no X shift, no jump).
  const startTransition = use_startTransition({
    SHELL_WIDTH_EXPANDED,
    animationControlsRef: state.animationControlsRef,
    codeExpandedRef: state.codeExpandedRef,
    scrollContainerRef: state.scrollContainerRef,
    shellWidth,
    wasAtBottomRef: state.wasAtBottomRef,
  });
  // Scan [data-code-msg] elements and check if any intersect the scroll container
  // viewport. Called on every scroll event and after every messages update.
  // Uses a stability gate: the visibility must hold its new state for
  // STABILITY_MS before a transition fires. This filters out the rapid
  // visible↔invisible flicker that occurs when a code block crosses the
  // viewport edge during a fast scroll, which would otherwise interrupt
  // the 0.7s tween mid-flight and cause stutter.
  const STABILITY_MS = 120;
  const checkCodeVisibility = use_checkCodeVisibility({
    SHELL_WIDTH_COLLAPSED,
    SHELL_WIDTH_EXPANDED,
    STABILITY_MS,
    codeExpandedRef: state.codeExpandedRef,
    pendingVisibilityRef: state.pendingVisibilityRef,
    scrollContainerRef: state.scrollContainerRef,
    stableVisibilityTimerRef: state.stableVisibilityTimerRef,
    startTransition,
  });
  // Re-check after every messages update (catches mid-stream code fences).

  // Re-attach scroll listener whenever messages change — the scroll container
  // is conditionally rendered so scrollContainerRef.current is null at mount.
  //
  // The visibility check does layout reads (querySelectorAll +
  // getBoundingClientRect on every code element). Running it synchronously
  // on every scroll event forces a layout flush mid-scroll-frame, which
  // shows up as text jitter during fast scrolls. rAF-coalescing it ensures
  // at most one check per frame and lets the read happen at the natural
  // post-scroll layout point in the frame lifecycle.

  // ────────────────────────────────────────────────────────────────────────

  // Build conversation context from messages

  // Listen for settings window visibility changes

  // Sync Window Visibility with Expanded State

  // Keyboard shortcut to toggle expanded state (via Main Process)

  // Ensure overlay is expanded when requested by main process (e.g. after switching to overlay mode).
  // IMPORTANT: set isStealthRef before setIsExpanded so that if isExpanded was false, the
  // isExpanded effect fires showWindow(true) instead of showWindow(false). Without this,
  // ensure-expanded on a collapsed overlay would trigger show()+focus(), breaking stealth.

  // Session Reset Listener - Clears UI when a NEW meeting starts

  const handleScreenshotAttach = use_handleScreenshotAttach({
    setAttachedContext: state.setAttachedContext,
    setIsExpanded: state.setIsExpanded,
  });
  // STT Status listener — must survive isExpanded changes.
  // If registered inside the [isExpanded] effect, events are dropped during cleanup.

  // ── PERF: streaming-token rAF coalescing ─────────────────────────────────
  // Token streams (LLM answers) used to call setMessages PER TOKEN. Groq
  // emits ~200–400 tok/s, so a 400-token answer triggered 400 React renders
  // — each one cloning the messages array and re-rendering every prior row.
  //
  // queueToken accumulates incoming tokens for a given intent into a ref-
  // backed buffer; the FIRST token in a frame schedules a single
  // requestAnimationFrame that flushes the buffer with one setMessages.
  // Result: at most ~60 setMessages/sec regardless of token rate.
  //
  // flushToken() is called by the "final answer" handlers BEFORE they apply
  // their own setMessages, so any tokens still pending in the buffer are
  // committed to the streaming row first — guarantees no token is lost on
  // stream completion.
  //
  // Single-buffer design (not per-intent) is fine because LLM streams never
  // overlap by intent in this app. If the intent changes mid-stream we
  // synchronously flush the previous intent's buffer before queuing.
  // Sprint 13: React 18 concurrent mode — wrap streaming setMessages in
  // reactStartTransition (React's startTransition, aliased to avoid the
  // name clash with the local shell-width tween helper) so user input
  // (clicks, keypresses, scrolling) gets higher render priority than
  // streaming reconciliation. React can interrupt and resume the messages
  // render between frames if a higher-priority update arrives. Negligible
  // cost on small renders, real win when long history is in flight.
  const { queueToken, flushToken } = useTokenBuffer({
    setMessages: state.setMessages,
    tokenBufRef: state.tokenBufRef,
    reactStartTransition,
  });
  // ──────────────────────────────────────────────────────────────────────────

  // Connect to Native Audio Backend

  // Stable mount-only effect for screenshot listeners.
  // These MUST NOT be inside the [isExpanded] effect — when a screenshot is
  // taken, `switchToOverlay` fires `ensure-expanded` which can flip isExpanded
  // from false→true, triggering the [isExpanded] effect cleanup. If `screenshot-taken`
  // arrives during that teardown gap the event is silently dropped (same issue
  // as clarify streaming listeners below). handleScreenshotAttach only uses stable
  // useState setters so a mount-only closure is safe here.

  // Stable mount-only effect for clarify streaming listeners.
  // These MUST NOT be inside the [isExpanded] effect — if the user
  // expands/collapses the panel while a clarify stream is in-flight,
  // the [isExpanded] effect would tear down and re-register listeners,
  // orphaning the final 'clarify' event and leaving isProcessing=true forever.

  // Quick Actions - Updated to use new Intelligence APIs

  // PERF: useCallback so the reference is stable between renders. MessageRow
  // (memoized below) receives this as a prop; without a stable identity its
  // memo comparator would never match and the bailout would not fire.
  const {
    handleCopy,
    handleWhatToSay,
    handleFollowUp,
    handleRecap,
    handleFollowUpQuestions,
    handleClarify,
    handleCodeHint,
  } = useQuickActions({
    setMessages: state.setMessages,
    setAttachedContext: state.setAttachedContext,
    setIsExpanded: state.setIsExpanded,
    setIsProcessing: state.setIsProcessing,
    setLatestUsedImageInput: state.setLatestUsedImageInput,
    setLatestVisionFailureReason: state.setLatestVisionFailureReason,
    setLatestVisionModelUsed: state.setLatestVisionModelUsed,
    setLatestVisionProviderUsed: state.setLatestVisionProviderUsed,
    setScreenContextStatus: state.setScreenContextStatus,
    handleWhatToSayRef: state.handleWhatToSayRef,
    messagesEndRef: state.messagesEndRef,
    pendingCaptureRef: state.pendingCaptureRef,
    analytics,
    attachedContext: state.attachedContext,
  });

  const { handleBrainstorm, handleAnswerNow, handleManualSubmit } =
    useAnswerCall({
      setMessages: state.setMessages,
      setAttachedContext: state.setAttachedContext,
      setInputValue: state.setInputValue,
      setIsExpanded: state.setIsExpanded,
      setIsManualRecording: state.setIsManualRecording,
      setIsProcessing: state.setIsProcessing,
      setManualTranscript: state.setManualTranscript,
      setVoiceInput: state.setVoiceInput,
      setActiveListeningSessionActive,
      activeListeningEnabledRef: state.activeListeningEnabledRef,
      answerAutoFinishRef: state.answerAutoFinishRef,
      answerCallSessionActiveRef: state.answerCallSessionActiveRef,
      answerSttHadSpeechRef: state.answerSttHadSpeechRef,
      answerSttLastActivityRef: state.answerSttLastActivityRef,
      applyActiveListeningOnMeetingStartRef: state.applyActiveListeningOnMeetingStartRef,
      finishAnswerNowTurnRef: state.finishAnswerNowTurnRef,
      handleAnswerNowRef: state.handleAnswerNowRef,
      handleManualSubmitRef: state.handleManualSubmitRef,
      isRecordingRef: state.isRecordingRef,
      manualTranscriptRef: state.manualTranscriptRef,
      messagesEndRef: state.messagesEndRef,
      requestStartTimeRef: state.requestStartTimeRef,
      resumeAnswerCallListeningRef: state.resumeAnswerCallListeningRef,
      startAnswerNowListeningRef: state.startAnswerNowListeningRef,
      tokenBufRef: state.tokenBufRef,
      voiceInputRef: state.voiceInputRef,
      flushToken,
      syncAnswerCallSession,
      refreshProfileListeningRefs,
      enrichSystemPromptWithUserContext,
      getActiveAiProfileId,
      loadUserSessionData,
      mergeConversationContextWithUserSession,
      analytics,
      conversationContext: state.conversationContext,
      inputValue: state.inputValue,
      isCallMode,
      isConnected: state.isConnected,
      isManualRecording: state.isManualRecording,
      sttNotConfigured: state.sttNotConfigured,
      sttUserError: state.sttUserError,
      sttUserStatus: state.sttUserStatus,
      attachedContext: state.attachedContext,
    });

  const clearChat = use_clearChat({ setMessages: state.setMessages });
  // PERF: useCallback so MessageRow's memo comparator can rely on a stable
  // function identity. Deps are the things the closure actually reads that
  // can change: theme + memoized markdown components + memoized appearance.
  // setMessages is a stable React setter and isLightTheme drives both the
  // other deps so its inclusion is mostly defensive.
  const renderMessageText = use_renderMessageText({
    appearance,
    codeBlockClass,
    codeHeaderClass,
    codeHeaderTextClass,
    codeLineNumberColor,
    codeTheme,
    isLightTheme,
    mdComponents,
    setMessages: state.setMessages,
    subtleSurfaceClass,
  });
  const handlersRef = useRef({
    handleWhatToSay,
    handleFollowUp,
    handleFollowUpQuestions,
    handleRecap,
    handleAnswerNow,
    handleClarify,
    handleCodeHint,
    handleBrainstorm,
  });

  // Update ref on every render so the event listener always access latest state/props
  handlersRef.current = {
    handleWhatToSay,
    handleFollowUp,
    handleFollowUpQuestions,
    handleRecap,
    handleAnswerNow,
    handleClarify,
    handleCodeHint,
    handleBrainstorm,
  };


  // General Global Shortcuts (Rebindable)
  // We listen here to handle them when the window is focused (renderer side)
  // Global shortcuts (when window blurred) are handled by Main process -> GlobalShortcuts
  // But Main process events might not reach here if we don't listen, or we want unified handling.
  // Actually, KeybindManager registers global shortcuts. If they are registered as global,
  // Electron might consume them before they reach here?
  // 'toggle-app' is Global.
  // 'toggle-visibility' is NOT Global in default config (isGlobal: false), so it depends on focus.
  // So we MUST listen for them here.

  const generalHandlersRef = useOverlayGeneralShortcuts({
    isShortcutPressed,
    isProcessing: state.isProcessing,
    isMousePassthrough: state.isMousePassthrough,
    setIsProcessing: state.setIsProcessing,
    setMessages: state.setMessages,
    setAttachedContext: state.setAttachedContext,
    setInputValue: state.setInputValue,
    setIsMousePassthrough: state.setIsMousePassthrough,
    handleWhatToSay,
    handleScreenshotAttach,
  });

  // Global "Capture & Process" shortcut handler (issue #90)
  // Registered separately so it always has the latest handlersRef via stable ref access.
  // Main process takes the screenshot and sends "capture-and-process" with path+preview;
  // we attach the screenshot to context and immediately trigger AI analysis.

  // Inertial-scroll engine. Each globalShortcut fire kicks velocity on one
  // axis; a single RAF loop integrates position with friction. A lone tap
  // glides ~250ms then decays; rapid taps sustain motion. Needed because
  // Carbon HotKey on macOS does not auto-repeat with Cmd held, so naive
  // per-fire scrollBy(100px) produces stuttery, taps-only motion.

  // Stealth Global Shortcuts Handler
  // Listens for shortcuts triggered when the app is in the background

  // ── Stealth keyboard tap (CGEventTap) — true Cluely-grade input path ──
  //
  // When the OS-level tap is engaged (toggled by Cmd/Ctrl+Shift+Space),
  // every keystroke is captured BEFORE the foreground app sees it and
  // forwarded here. We append `chars` directly to inputValue without ever
  // touching DOM focus — the chat input never has to be the active element,
  // so the panel never has to be the key window. Zoom/browser stays as the
  // OS frontmost+key application throughout the entire typing session.
  //
  // HID virtual keycodes referenced below (stable across layouts):
  //   36 = Return,  48 = Tab,  51 = Delete (Backspace),  53 = Esc,
  //   76 = Numpad Enter,  123 = Left,  124 = Right,  125 = Down,  126 = Up.

  // ── Stealth hotkey registration-failure listener ──
  //
  // KeybindManager fires this when globalShortcut.register() returns false
  // (the OS or another app owns the accelerator). Without surfacing it,
  // the user presses the hotkey, nothing happens, and they assume the
  // stealth feature is broken. We filter to the stealth-typing keybind
  // and render an inline banner pointing to Settings → Shortcuts.

  // ── Click-to-activate: engage CGEventTap on chat-input click only
  //    (opt-IN model) ──
  //
  // ROUND 3 FIX (#1): previously this listener engaged the tap on ANY
  // mousedown anywhere in the overlay (opt-OUT via data-stealth-ignore).
  // That model broke hard: clicking the Settings button engaged the tap,
  // then Settings opened and the user couldn't type their API key (tap
  // intercepted at OS level → keystrokes went to Momor's read-only
  // chat input). Worse, every NEW button added to the overlay was a
  // regression risk — forgetting `data-stealth-ignore` re-introduced the
  // bug silently.
  //
  // Inverted to opt-IN: tap ONLY engages when the user clicks an element
  // marked with `data-stealth-engage="true"` (the chat input wrapper).
  // Buttons run their normal onClick handlers without engaging the tap.
  // Two paths still let the user start typing stealth-style:
  //   • Click the chat input → tap engages → DOM focus blocked → type
  //   • Press the activation hotkey (Cmd/Ctrl+Shift+Space) → tap engages
  //
  // mousedown (not click) so we engage BEFORE the input would otherwise
  // take DOM focus — preventing the panel from becoming key window, which
  // is the precise event coding-interview platforms detect via blur.

  // ── ModelSelector click-outside close ──
  //
  // ROUND 3 FIX (#4): replaces the dead `on('blur')` handler in the
  // ModelSelectorWindowHelper. With NSPanel-nonactivating the model-
  // selector window may never become key on click, so its blur listener
  // never fires and the dropdown stays open forever. We close it here
  // by firing an IPC on every overlay mousedown EXCEPT clicks on the
  // toggle button itself (which would race with toggleWindow's open/close
  // logic). Main process no-ops the IPC if model selector is already
  // closed.

  // ── Input-click DOM-focus block ──
  //
  // When the user clicks the chat input, the browser tries to focus the
  // <input> element. That focus promotes the NSPanel to key window —
  // which fires window.onblur on whatever app was previously focused
  // (Zoom, browser, IDE). preventDefault() on mousedown blocks the focus
  // attempt entirely. The above mousedown listener has already fired
  // stealthTapStart() in capture phase, so by the time we get here, the
  // tap is engaging and DOM focus is no longer the typing path.
  const blockInputFocus = use_blockInputFocus({
    stealthAutoEngageOkRef: state.stealthAutoEngageOkRef,
    stealthTapAvailableRef: state.stealthTapAvailableRef,
    textInputRef: state.textInputRef,
  });
  // ── Derived STT status for the rolling transcript indicator (interviewer channel) ──
  const interviewerSttIndicatorStatus = state.sttInterviewerStatus;
  // Strip consecutive error count from display — show only in expanded diagnostics
  const interviewerSttIndicatorError = state.sttInterviewerError?.replace(
    /\s*\(\d+ consecutive errors\):?/gi,
    "",
  );
  const sttSummary = getSttSummary(
    state.sttUserStatus,
    state.sttInterviewerStatus,
    state.sttUserProvider,
    sttInterviewerProvider,
    state.sttNotConfigured,
  );
  const sttSummaryDetail = state.sttNotConfigured
    ? t("overlay.sttOpenAudioSettings")
    : sttSummary.detail;
  // Zed Chip metrics: tight rounded-sm, 1px element border, 10px label.
  const statusPillBaseClass = `flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-xl bg-linear-surface-1 border-linear-hairline text-linear-ink`;

  const copyDiagnostics = use_copyDiagnostics({
    sttUserStatus: state.sttUserStatus,
    sttUserProvider: state.sttUserProvider,
    sttInterviewerStatus: state.sttInterviewerStatus,
    sttInterviewerProvider,
    sttInterviewerError: state.sttInterviewerError,
    sttUserError: state.sttUserError,
  });
  // Cancel all in-flight async work on unmount.

  // Relocated (TDZ): run after all refs/fns declared

  // Relocated hook calls (consolidated before render)

  useOverlayWiring(state, {
    checkCodeVisibility,
    flushToken,
    generalHandlersRef,
    handleScreenshotAttach,
    handlersRef,
    isShortcutPressed,
    queueToken,
    refreshProfileListeningRefs,
    refreshSttProfileUi,
    reportShellSize,
    syncAnswerCallSession,
    triggerAnswerNowEndpoint,
    setActiveListeningSessionActive,
    setStealthPermissionMissing,
    setSttInterviewerProvider,
    analytics,
    detectProviderType,
    USER_CONTEXT_CHANGED_EVENT,
    commitRollingWithLive,
    syncUserSessionContextToMain,
    getAnswerCallEndpointPauseMs,
    formatProviderLabel,
    isUserMicSpeaker,
    hasInterviewerQuestionSignal,
    AUTO_SUGGEST_COOLDOWN_MS,
  });

  return {
    ...state,
    overlayPanelClass,
    getStatusToneClass,
    appearance,
    blockInputFocus,
    controlSurfaceClass,
    copyDiagnostics,
    handleAnswerNow,
    handleBrainstorm,
    handleClarify,
    handleCopy,
    handleFollowUpQuestions,
    handleManualSubmit,
    handleModelSelect,
    handleRecap,
    handleSttProfileSelect,
    handleWhatToSay,
    inputClass,
    interviewerSttIndicatorError,
    interviewerSttIndicatorStatus,
    isCallMode,
    isGlassTheme,
    isLightTheme,
    mention,
    mentionIndex,
    mentionItems,
    onComposerChange,
    onEndMeeting,
    quickActionClass,
    renderMessageText,
    rollingTranscriptPreview,
    scrollMaxH,
    selectMention,
    setMention,
    setMentionIndex,
    setStealthPermissionMissing,
    shellRef,
    shellWidth,
    statusPillBaseClass,
    stealthPermissionMissing,
    sttInterviewerProvider,
    subtleSurfaceClass,
    t,
    userRollingTranscriptPreview,
  };
}
