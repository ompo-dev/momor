import React, { useEffect } from "react";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;
type Fn = (...args: any[]) => any;

interface Deps {
  setMessages: Setter;
  setInputValue: Setter;
  setAttachedContext: Setter;
  setManualTranscript: Setter;
  setVoiceInput: Setter;
  setRollingCommitted: Setter;
  setRollingLive: Setter;
  setUserRollingCommitted: Setter;
  setUserRollingLive: Setter;
  setIsInterviewerSpeaking: Setter;
  setIsUserSpeaking: Setter;
  setIsProcessing: Setter;
  setIsManualRecording: Setter;
  setActiveListeningSessionActive: Setter;
  setSttUserStatus: Setter;
  setSttInterviewerStatus: Setter;
  setSttUserError: Setter;
  setSttInterviewerError: Setter;
  manualTranscriptRef: Ref;
  voiceInputRef: Ref;
  rollingLiveRef: Ref;
  userRollingLiveRef: Ref;
  isRecordingRef: Ref;
  answerAutoFinishRef: Ref;
  syncAnswerCallSession: Fn;
  analytics: any;
}

/** Session-reset listener: clears all UI/transcript state on new meeting. Verbatim relocation (deps array unchanged). */
export function useSessionReset({
    setMessages,
    setInputValue,
    setAttachedContext,
    setManualTranscript,
    setVoiceInput,
    setRollingCommitted,
    setRollingLive,
    setUserRollingCommitted,
    setUserRollingLive,
    setIsInterviewerSpeaking,
    setIsUserSpeaking,
    setIsProcessing,
    setIsManualRecording,
    setActiveListeningSessionActive,
    setSttUserStatus,
    setSttInterviewerStatus,
    setSttUserError,
    setSttInterviewerError,
    manualTranscriptRef,
    voiceInputRef,
    rollingLiveRef,
    userRollingLiveRef,
    isRecordingRef,
    answerAutoFinishRef,
    syncAnswerCallSession,
    analytics,
}: Deps) {
  useEffect(() => {
    if (!window.electronAPI?.onSessionReset) return;
    const unsubscribe = window.electronAPI.onSessionReset(() => {
      console.log("[momorInterface] Resetting session state...");
      setMessages([]);
      setInputValue("");
      setAttachedContext([]);
      setManualTranscript("");
      manualTranscriptRef.current = "";
      setVoiceInput("");
      voiceInputRef.current = "";
      setRollingCommitted("");
      setRollingLive("");
      rollingLiveRef.current = "";
      setUserRollingCommitted("");
      setUserRollingLive("");
      userRollingLiveRef.current = "";
      setIsInterviewerSpeaking(false);
      setIsUserSpeaking(false);
      setIsProcessing(false);
      setIsManualRecording(false);
      isRecordingRef.current = false;
      answerAutoFinishRef.current = false;
      syncAnswerCallSession(false);
      setActiveListeningSessionActive(false);
      setSttUserStatus("connected");
      setSttInterviewerStatus("connected");
      setSttUserError("");
      setSttInterviewerError("");
      // Optionally reset connection status if needed, but connection persists

      // Track new conversation/session if applicable?
      analytics.trackConversationStarted();
    });
    return () => unsubscribe();
  }, []);
}
