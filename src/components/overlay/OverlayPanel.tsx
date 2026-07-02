import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useMemo,
  useCallback,
  startTransition as reactStartTransition,
} from "react";
import { useOverlayStore } from "../../stores/overlayStore";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import TopPill from "../ui/TopPill";
import CollapsedWidget from "./CollapsedWidget";
import MessageRow from "./MessageRow";
import OverlayComposer from "./organisms/OverlayComposer";
import OverlayActionBar from "./organisms/OverlayActionBar";
import AgentToolChips from "./molecules/AgentToolChips";
import OverlayWarningBanners from "./molecules/OverlayWarningBanners";
import OverlayStealthBanners from "./molecules/OverlayStealthBanners";
import AttachedScreenshotPreview from "./molecules/AttachedScreenshotPreview";
import RollingTranscript from "../ui/RollingTranscript";
import GlassEffectLayer from "../ui/GlassEffectLayer";
import { DynamicActionBar } from "../dynamic-actions/DynamicActionBar";
import { Button } from "../ui/button";
import type { DynamicActionPayload } from "../../types/electron";

interface OverlayPanelProps {
  overlayPanelClass: any;
  getStatusToneClass: any;
  appearance: any;
  blockInputFocus: any;
  contentRef: any;
  controlSurfaceClass: any;
  copyDiagnostics: any;
  handleAnswerNow: any;
  handleBrainstorm: any;
  handleClarify: any;
  handleCopy: any;
  handleFollowUpQuestions: any;
  handleManualSubmit: any;
  handleModelSelect: any;
  handleRecap: any;
  handleSttProfileSelect: any;
  handleWhatToSay: any;
  inputClass: any;
  interviewerSttIndicatorError: any;
  interviewerSttIndicatorStatus: any;
  isCallMode: any;
  isGlassTheme: any;
  isLightTheme: any;
  mention: any;
  mentionIndex: any;
  mentionItems: any[];
  messagesEndRef: any;
  onComposerChange: any;
  onEndMeeting: any;
  quickActionClass: any;
  renderMessageText: any;
  rollingTranscriptPreview: any;
  scrollContainerRef: any;
  scrollMaxH: any;
  selectMention: any;
  setMention: any;
  setMentionIndex: any;
  setStealthPermissionMissing: any;
  shellRef: any;
  shellWidth: any;
  statusPillBaseClass: any;
  stealthPermissionMissing: any;
  sttInterviewerProvider: any;
  subtleSurfaceClass: any;
  t: any;
  textInputRef: any;
  userRollingTranscriptPreview: any;
}

type AgentPermissionRequest = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
};

/** Overlay render tree (presentational). All logic lives in MomorInterface hooks. */
export default function OverlayPanel({
  overlayPanelClass,
  getStatusToneClass,
  appearance,
  blockInputFocus,
  contentRef,
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
  messagesEndRef,
  onComposerChange,
  onEndMeeting,
  quickActionClass,
  renderMessageText,
  rollingTranscriptPreview,
  scrollContainerRef,
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
  textInputRef,
  userRollingTranscriptPreview,
}: OverlayPanelProps) {
  const [permissionRequest, setPermissionRequest] =
    useState<AgentPermissionRequest | null>(null);
  const {
    setAttachedContext,
    setInputValue,
    setIsCollapsed,
    setIsMousePassthrough,
    setStealthHotkeyConflict,
    setSttNotConfigured,
    setSystemAudioWarning,
    actionButtonMode,
    agentTools,
    answerCallSessionActive,
    attachedContext,
    currentModel,
    currentSttLabel,
    currentSttProfileId,
    inputValue,
    isCollapsed,
    isExpanded,
    isInterviewerSpeaking,
    isManualRecording,
    isMousePassthrough,
    isProcessing,
    isSettingsOpen,
    isUserSpeaking,
    manualTranscript,
    messages,
    showTranscript,
    stealthHotkeyConflict,
    stealthTapActive,
    sttNotConfigured,
    sttUserError,
    sttUserProvider,
    sttUserStatus,
    systemAudioWarning,
    voiceInput,
  } = useOverlayStore();

  useEffect(() => {
    const cleanup = window.electronAPI?.onAgentPermissionRequest?.((data) => {
      setPermissionRequest(data);
    });
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    const cleanups = [
      window.electronAPI?.onGeminiStreamDone?.(() => setPermissionRequest(null)),
      window.electronAPI?.onGeminiStreamError?.(() => setPermissionRequest(null)),
      window.electronAPI?.onAgentStreamDone?.(() => setPermissionRequest(null)),
      window.electronAPI?.onAgentStreamError?.(() => setPermissionRequest(null)),
    ].filter(Boolean) as Array<() => void>;
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const respondPermission = useCallback(
    (allow: boolean) => {
      if (!permissionRequest) return;
      void window.electronAPI?.agentRespondPermission?.({
        id: permissionRequest.id,
        allow,
        message: allow ? undefined : "Denied by user",
      });
      setPermissionRequest(null);
    },
    [permissionRequest],
  );

  return (
    <div
      ref={contentRef}
      data-interface-theme={isGlassTheme ? "liquid-glass" : undefined}
      className="flex flex-col items-center w-fit mx-auto h-fit min-h-0 bg-transparent p-0 rounded-[24px] font-sans gap-2 overlay-text-primary"
    >
      <AnimatePresence>
        {isExpanded && isCollapsed && (
          <CollapsedWidget
            active={isInterviewerSpeaking || isUserSpeaking}
            appearance={appearance}
            onExpand={() => setIsCollapsed(false)}
            onStop={() =>
              onEndMeeting ? onEndMeeting() : window.electronAPI.quitApp()
            }
            sessionStartMs={
              Number(localStorage.getItem("momor_last_meeting_start")) || null
            }
          />
        )}
        {isExpanded && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2 w-full"
          >
            <TopPill
              expanded={isExpanded}
              onToggle={() => setIsCollapsed(true)}
              onQuit={() =>
                onEndMeeting ? onEndMeeting() : window.electronAPI.quitApp()
              }
              appearance={appearance}
              onLogoClick={() =>
                window.electronAPI?.setWindowMode?.("launcher")
              }
            />
            <motion.div
              ref={shellRef}
              className={`relative max-w-full backdrop-blur-2xl border rounded-[24px] overflow-hidden flex flex-col draggable-area overlay-shell-surface ${overlayPanelClass}`}
              style={{
                ...appearance.shellStyle,
                width: shellWidth,
                // Removed will-change: 'width' — Framer Motion animates shellWidth
                // using transform (translateX), not CSS width, so this hint created
                // a ghost compositor layer with stale dimensions from the first
                // meeting's layout, blocking correct compositing on remount.
              }}
            >
              {isGlassTheme && (
                <GlassEffectLayer parentRef={shellRef} cornerRadius={24} />
              )}

              {/* Status pills removed for a cleaner top. Critical problems still
                  surface via the banners below. */}

              {/* Agent tool/skill usage chips for the current turn */}
              <AgentToolChips
                tools={agentTools}
                pillBaseClass={statusPillBaseClass}
                toneClass={getStatusToneClass}
              />

              {/* Warning banners: screen-recording denied + STT not configured */}
              <OverlayWarningBanners
                onDismissSystemAudio={() => setSystemAudioWarning(null)}
                onDismissStt={() => setSttNotConfigured(false)}
              />

              {/* Phase 3 — Dynamic action card row (Cluely-style live triggers).
                                Appears between status pills and rolling transcript so users see
                                actionable suggestions in their primary scan path. Bar self-hides
                                when no actions are present. */}
              <DynamicActionBar
                onAcceptAction={(action: DynamicActionPayload) => {
                  void handleWhatToSay(action.promptInstruction);
                }}
              />

              {/* Rolling Transcript Bar — includes STT status indicator inline */}
              {(showTranscript &&
                (rollingTranscriptPreview || userRollingTranscriptPreview)) ||
              interviewerSttIndicatorStatus !== "connected" ||
              sttUserStatus !== "connected" ? (
                <RollingTranscript
                  text={showTranscript ? rollingTranscriptPreview : ""}
                  isActive={isInterviewerSpeaking}
                  userText={showTranscript ? userRollingTranscriptPreview : ""}
                  isUserActive={isUserSpeaking}
                  surfaceStyle={
                    showTranscript ? appearance.transcriptStyle : undefined
                  }
                  interviewerChannel={{
                    status: interviewerSttIndicatorStatus,
                    error: interviewerSttIndicatorError,
                    provider: sttInterviewerProvider,
                  }}
                  microphoneChannel={{
                    status: sttUserStatus,
                    error: sttUserError,
                    provider: sttUserProvider,
                  }}
                  onCopyDiagnostics={copyDiagnostics}
                />
              ) : null}

              {/* Chat History - Only show if there are messages OR active states */}
              {(messages.length > 0 || isManualRecording || isProcessing) && (
                <motion.div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3 no-drag"
                  style={{ scrollbarWidth: "none", maxHeight: scrollMaxH }}
                >
                  {/* Every row spans the full inner width of the scroll
                                        container, which itself rides the shell's animated
                                        width. Bubble max-widths are percentages so the text
                                        and code grow with the canvas — same as iMessage /
                                        Mail when their windows resize. Reflow during the
                                        700 ms tween is gentle (≈0.3 px / frame width delta)
                                        and reads as the canvas "breathing", not jitter.
                                        The other polish (sticky bottom, stable code line
                                        layout via wrapLongLines:false, stability gate that
                                        suppresses transitions during scroll) keeps the
                                        motion calm.

                                        Each row is rendered through React.memo'd MessageRow
                                        so a setMessages on the streaming row does NOT
                                        re-render every prior message — bailout fires on
                                        identity equality (msg, theme, callbacks). */}
                  {messages.map((msg) => (
                    <MessageRow
                      key={msg.id}
                      msg={msg}
                      isLightTheme={isLightTheme}
                      appearance={appearance}
                      onCopy={handleCopy}
                      renderMessageText={renderMessageText}
                    />
                  ))}

                  {/* Active Recording State with Live Transcription */}
                  {isManualRecording && (
                    <div className="flex flex-col items-start gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* Live transcription preview */}
                      {(manualTranscript || voiceInput) && (
                        <div className="max-w-[88%] overlay-subtle-surface rounded-md border px-3 py-2">
                          <span className="text-[13px] overlay-text-secondary">
                            {voiceInput}
                            {voiceInput && manualTranscript ? " " : ""}
                            {manualTranscript}
                          </span>
                        </div>
                      )}
                      <div className="px-2.5 py-1.5 flex gap-1.5 items-center overlay-subtle-surface border rounded-md">
                        <div
                          className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                        <span className="text-[10px] text-emerald-400/70 ml-1">
                          {t("overlay.listeningIndicator")}
                        </span>
                      </div>
                    </div>
                  )}

                  {isProcessing &&
                    !messages.some(
                      (m) => m.isStreaming && m.intent === "what_to_answer",
                    ) && (
                      <div className="flex justify-start">
                        <div
                          className="px-3 py-2 flex gap-1.5 overlay-subtle-surface rounded-full border"
                          style={appearance.subtleStyle}
                        >
                          <div
                            className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <div
                            className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <div
                            className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      </div>
                    )}
                  <div ref={messagesEndRef} />
                </motion.div>
              )}

              {/* Quick Actions */}
              <OverlayActionBar
                onWhatToSay={handleWhatToSay}
                onClarify={handleClarify}
                onRecap={handleRecap}
                onBrainstorm={handleBrainstorm}
                onFollowUpQuestions={handleFollowUpQuestions}
                onAnswerNow={handleAnswerNow}
                isCallMode={isCallMode}
                quickActionClass={quickActionClass}
                chipStyle={appearance.chipStyle}
                tightTop={!!(rollingTranscriptPreview && showTranscript)}
              />

              {/* Input Area */}
              <div className="p-3 pt-0">
                {/* Attached screenshot preview + vision question input */}
                <AttachedScreenshotPreview
                  items={attachedContext}
                  onClearAll={() => setAttachedContext([])}
                  onRemoveAt={(idx) =>
                    setAttachedContext((prev) =>
                      prev.filter((_, i) => i !== idx),
                    )
                  }
                  inputRef={textInputRef}
                  onInputChange={setInputValue}
                  onSubmit={() => void handleManualSubmit()}
                  isLightTheme={isLightTheme}
                  subtleSurfaceClass={subtleSurfaceClass}
                  inputClass={inputClass}
                  appearance={appearance}
                />

                {/* Stealth banners: hotkey conflict + accessibility permission */}
                <OverlayStealthBanners
                  onDismissHotkeyConflict={() => setStealthHotkeyConflict(null)}
                  stealthPermissionMissing={stealthPermissionMissing}
                  onDismissPermission={() => setStealthPermissionMissing(false)}
                />

                {/* data-stealth-engage marks this subtree as
                                    the ONLY clickable region that engages the
                                    CGEventTap. See the click-to-activate
                                    useEffect (~line 2840) for the opt-IN
                                    rationale — buttons elsewhere in the
                                    overlay no longer accidentally engage the
                                    tap and break inputs in Settings/Model
                                    Selector windows. */}
                {/* Zed-style agent composer — editor on top, toolbar below, in one
                    focus-ringed box. Footer splits utility (left) / selectors + send (right). */}
                <OverlayComposer
                  onChange={onComposerChange}
                  onSubmit={() => void handleManualSubmit()}
                  onMouseDownInput={blockInputFocus}
                  attachedCount={attachedContext.length}
                  inputRef={textInputRef}
                  mention={mention}
                  mentionItems={mentionItems}
                  mentionIndex={mentionIndex}
                  setMention={setMention}
                  setMentionIndex={setMentionIndex}
                  onSelectMention={selectMention}
                  onSelectModel={handleModelSelect}
                  onSelectStt={handleSttProfileSelect}
                  controlSurfaceClass={controlSurfaceClass}
                  contentRef={contentRef}
                  onToggleMousePassthrough={() => {
                    const newState = !isMousePassthrough;
                    setIsMousePassthrough(newState);
                    window.electronAPI?.setOverlayMousePassthrough?.(newState);
                  }}
                  appearance={appearance}
                />
              </div>

              <AnimatePresence>
                {permissionRequest && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 p-4"
                  >
                    <motion.div
                      initial={{ scale: 0.96, y: 8 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.98, y: 4 }}
                      className="w-full max-w-[420px] rounded-2xl border overlay-shell-surface p-5 shadow-2xl"
                    >
                      <div className="text-[14px] font-semibold overlay-text-primary">
                        Permitir a acao do agente?
                      </div>
                      <div className="mt-1 text-[12px] overlay-text-secondary">
                        O agente quer usar{" "}
                        <span className="font-mono overlay-text-primary">
                          {permissionRequest.tool}
                        </span>
                        .
                      </div>
                      {Object.keys(permissionRequest.input || {}).length > 0 && (
                        <pre className="mt-3 max-h-40 overflow-y-auto rounded-xl border overlay-subtle-surface px-3 py-2 font-mono text-[11px] overlay-text-secondary whitespace-pre-wrap">
                          {JSON.stringify(permissionRequest.input, null, 2).slice(
                            0,
                            900,
                          )}
                        </pre>
                      )}
                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => respondPermission(false)}
                        >
                          Negar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => respondPermission(true)}
                        >
                          Permitir
                        </Button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
