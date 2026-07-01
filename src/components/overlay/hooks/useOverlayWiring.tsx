import React, {
  useState,
  useRef,
  useLayoutEffect,
  startTransition as reactStartTransition,
} from "react";
import { useOverlayScrollAndChatShortcuts } from "./useOverlayScrollAndChatShortcuts";
import { useStealthGlobalShortcuts } from "./useStealthGlobalShortcuts";
import { useLiveMeetingListeners } from "./useLiveMeetingListeners";
import { useAgentStreamListeners } from "./useAgentStreamListeners";
import { useInertialScroll } from "./useInertialScroll";
import { useStealthTap } from "./useStealthTap";
import { useClarifyStream } from "./useClarifyStream";
import { useSessionReset } from "./useSessionReset";
import { useStealthAutoEngage } from "./useStealthAutoEngage";
import { useCaptureAndProcess } from "./useCaptureAndProcess";
import { useSttStatusListener } from "./useSttStatusListener";
import { useAgentToolChips } from "./useAgentToolChips";
import { useOverlayModeInit } from "./useOverlayModeInit";
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
} from "./useOverlayFx";
import {
  useDefaultModelLoader,
  useSttConfigListener,
  useScrollCodeVisibility,
  useOverlayUnmountCleanup,
  useUserContextSync,
  useAnswerEndpointWatcher,
} from "./useOverlayEffects";

export function useOverlayWiring(state: any, ctx: any) {
  const {
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
  } = ctx;
  useOverlayFx1({ setShowTranscript: state.setShowTranscript });
  useOverlayFx2({ setAutoScroll: state.setAutoScroll });
  useAnswerEndpointWatcher({
    isManualRecording: state.isManualRecording,
    answerSttHadSpeechRef: state.answerSttHadSpeechRef,
    isRecordingRef: state.isRecordingRef,
    answerAutoFinishRef: state.answerAutoFinishRef,
    answerSttLastActivityRef: state.answerSttLastActivityRef,
    getAnswerCallEndpointPauseMs,
    triggerAnswerNowEndpoint,
  });
  useOverlayModeInit({
    setActiveModeLabel: state.setActiveModeLabel,
    setLlmProviderLabel: state.setLlmProviderLabel,
    setLlmPrivacyLabel: state.setLlmPrivacyLabel,
    setActionButtonMode: state.setActionButtonMode,
    formatProviderLabel,
  });
  useDefaultModelLoader({ setCurrentModel: state.setCurrentModel });
  useOverlayFx4({ setCurrentModel: state.setCurrentModel });
  useOverlayFx5({ setIsUndetectable: state.setIsUndetectable });
  useOverlayFx6({ hideChatHidesWidget: state.hideChatHidesWidget, isUndetectable: state.isUndetectable });
  useOverlayFx7({ setIsMousePassthrough: state.setIsMousePassthrough });
  useOverlayFx8({ setIsExpanded: state.setIsExpanded, setSystemAudioWarning: state.setSystemAudioWarning });
  useOverlayFx9({ setIsExpanded: state.setIsExpanded, setSystemAudioWarning: state.setSystemAudioWarning });
  useSttConfigListener({ refreshSttProfileUi, setSttNotConfigured: state.setSttNotConfigured });
  useOverlayFx10({ isExpanded: state.isExpanded, isExpandedRef: state.isExpandedRef });
  useOverlayFx12({ isCollapsed: state.isCollapsed, isExpanded: state.isExpanded, setIsCollapsed: state.setIsCollapsed });
  useAgentToolChips({ setAgentTools: state.setAgentTools });
  useOverlayFx13({ isProcessing: state.isProcessing, setAgentTools: state.setAgentTools });
  useLayoutEffect(() => {
    if (!state.contentRef.current) return;

    const observer = new ResizeObserver(() => {
      if (state.rafDimUpdateRef.current)
        cancelAnimationFrame(state.rafDimUpdateRef.current);
      state.rafDimUpdateRef.current = requestAnimationFrame(() => {
        state.rafDimUpdateRef.current = null;
        reportShellSize();
      });
    });

    observer.observe(state.contentRef.current);
    return () => {
      observer.disconnect();
      if (state.rafDimUpdateRef.current) {
        cancelAnimationFrame(state.rafDimUpdateRef.current);
        state.rafDimUpdateRef.current = null;
      }
    };
  }, [reportShellSize]);
  useOverlayFx15({ attachedContext: state.attachedContext, textInputRef: state.textInputRef });
  useOverlayFx17({ checkCodeVisibility, messages: state.messages });
  useScrollCodeVisibility({
    scrollContainerRef: state.scrollContainerRef,
    checkCodeVisibility,
    messages: state.messages,
  });
  useOverlayFx18({ messages: state.messages, setConversationContext: state.setConversationContext });
  useOverlayFx19({ setIsSettingsOpen: state.setIsSettingsOpen });
  useOverlayFx20({ isExpanded: state.isExpanded, isStealthRef: state.isStealthRef });
  useOverlayFx21({ setIsExpanded: state.setIsExpanded });
  useOverlayFx22({ isStealthRef: state.isStealthRef, setIsExpanded: state.setIsExpanded });
  useSessionReset({
    setMessages: state.setMessages,
    setInputValue: state.setInputValue,
    setAttachedContext: state.setAttachedContext,
    setManualTranscript: state.setManualTranscript,
    setVoiceInput: state.setVoiceInput,
    setRollingCommitted: state.setRollingCommitted,
    setRollingLive: state.setRollingLive,
    setUserRollingCommitted: state.setUserRollingCommitted,
    setUserRollingLive: state.setUserRollingLive,
    setIsInterviewerSpeaking: state.setIsInterviewerSpeaking,
    setIsUserSpeaking: state.setIsUserSpeaking,
    setIsProcessing: state.setIsProcessing,
    setIsManualRecording: state.setIsManualRecording,
    setActiveListeningSessionActive,
    setSttUserStatus: state.setSttUserStatus,
    setSttInterviewerStatus: state.setSttInterviewerStatus,
    setSttUserError: state.setSttUserError,
    setSttInterviewerError: state.setSttInterviewerError,
    manualTranscriptRef: state.manualTranscriptRef,
    voiceInputRef: state.voiceInputRef,
    rollingLiveRef: state.rollingLiveRef,
    userRollingLiveRef: state.userRollingLiveRef,
    isRecordingRef: state.isRecordingRef,
    answerAutoFinishRef: state.answerAutoFinishRef,
    syncAnswerCallSession,
    analytics,
  });
  useSttStatusListener({
    setSttUserStatus: state.setSttUserStatus,
    setSttUserProvider: state.setSttUserProvider,
    setSttUserError: state.setSttUserError,
    setSttInterviewerStatus: state.setSttInterviewerStatus,
    setSttInterviewerProvider,
    setSttInterviewerError: state.setSttInterviewerError,
  });
  useLiveMeetingListeners({
    isExpanded: state.isExpanded,
    isUserMicSpeaker,
    setIsConnected: state.setIsConnected,
    setIsExpanded: state.setIsExpanded,
    setIsInterviewerSpeaking: state.setIsInterviewerSpeaking,
    setIsProcessing: state.setIsProcessing,
    setIsUserSpeaking: state.setIsUserSpeaking,
    setManualTranscript: state.setManualTranscript,
    setMessages: state.setMessages,
    setRollingCommitted: state.setRollingCommitted,
    setRollingLive: state.setRollingLive,
    setUserRollingCommitted: state.setUserRollingCommitted,
    setUserRollingLive: state.setUserRollingLive,
    setVoiceInput: state.setVoiceInput,
    activeListeningEnabledRef: state.activeListeningEnabledRef,
    answerSttHadSpeechRef: state.answerSttHadSpeechRef,
    answerSttLastActivityRef: state.answerSttLastActivityRef,
    autoSuggestEnabledRef: state.autoSuggestEnabledRef,
    handleWhatToSayRef: state.handleWhatToSayRef,
    isProcessingRef: state.isProcessingRef,
    isRecordingRef: state.isRecordingRef,
    lastAutoSuggestAtRef: state.lastAutoSuggestAtRef,
    manualTranscriptRef: state.manualTranscriptRef,
    rollingLiveRef: state.rollingLiveRef,
    userRollingLiveRef: state.userRollingLiveRef,
    voiceInputRef: state.voiceInputRef,
    commitRollingWithLive,
    hasInterviewerQuestionSignal,
    queueToken,
    flushToken,
    AUTO_SUGGEST_COOLDOWN_MS,
  });
  useOverlayFx23({ handleScreenshotAttach });
  useClarifyStream({ queueToken, flushToken, setIsProcessing: state.setIsProcessing, setMessages: state.setMessages });
  useOverlayScrollAndChatShortcuts({
    scrollContainerRef: state.scrollContainerRef,
    handlersRef,
    isShortcutPressed,
    actionButtonMode: state.actionButtonMode,
  });
  useCaptureAndProcess({
    setIsExpanded: state.setIsExpanded,
    pendingCaptureRef: state.pendingCaptureRef,
    setAttachedContext: state.setAttachedContext,
    handlersRef,
  });
  useInertialScroll({ scrollContainerRef: state.scrollContainerRef, inertialScrollRef: state.inertialScrollRef });
  useStealthGlobalShortcuts({
    handlersRef,
    generalHandlersRef,
    isStealthRef: state.isStealthRef,
    actionButtonMode: state.actionButtonMode,
    inertialScrollRef: state.inertialScrollRef,
    setIsExpanded: state.setIsExpanded,
    textInputRef: state.textInputRef,
  });
  useStealthTap({
    stealthTapActiveRef: state.stealthTapActiveRef,
    isStealthRef: state.isStealthRef,
    handleManualSubmitRef: state.handleManualSubmitRef,
    setStealthTapActive: state.setStealthTapActive,
    setIsExpanded: state.setIsExpanded,
    setStealthPermissionMissing,
    setInputValue: state.setInputValue,
  });
  useOverlayFx26({ setStealthHotkeyConflict: state.setStealthHotkeyConflict });
  useStealthAutoEngage({
    stealthTapAvailableRef: state.stealthTapAvailableRef,
    stealthAutoEngageOkRef: state.stealthAutoEngageOkRef,
    stealthTapActiveRef: state.stealthTapActiveRef,
  });
  useOverlayFx27({});
  useOverlayUnmountCleanup({
    animationControlsRef: state.animationControlsRef,
    rafDimUpdateRef: state.rafDimUpdateRef,
    stableVisibilityTimerRef: state.stableVisibilityTimerRef,
    pendingVisibilityRef: state.pendingVisibilityRef,
    tokenBufRef: state.tokenBufRef,
  });
  useOverlayFx3({ autoScroll: state.autoScroll, messages: state.messages, messagesEndRef: state.messagesEndRef });
  useOverlayFx11({ isCollapsed: state.isCollapsed, isCollapsedRef: state.isCollapsedRef, reportShellSize });
  useOverlayFx14({ attachedContext: state.attachedContext, reportShellSize });
  useOverlayFx16({ reportShellSize });
  useAgentStreamListeners({
    setMessages: state.setMessages,
    setIsProcessing: state.setIsProcessing,
    requestStartTimeRef: state.requestStartTimeRef,
    currentModel: state.currentModel,
    analytics,
    detectProviderType,
  });
  useOverlayFx24({ isProcessing: state.isProcessing, isProcessingRef: state.isProcessingRef });
  useUserContextSync({
    syncUserSessionContextToMain,
    refreshProfileListeningRefs,
    activeListeningEnabledRef: state.activeListeningEnabledRef,
    answerCallSessionActiveRef: state.answerCallSessionActiveRef,
    isRecordingRef: state.isRecordingRef,
    applyActiveListeningOnMeetingStartRef: state.applyActiveListeningOnMeetingStartRef,
    USER_CONTEXT_CHANGED_EVENT,
  });
  useOverlayFx25({
    applyActiveListeningOnMeetingStartRef: state.applyActiveListeningOnMeetingStartRef,
    refreshProfileListeningRefs,
  });
}
