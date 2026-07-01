import React, { useEffect } from "react";

type Setter = {
  (updater: (prev: any) => any): void;
  (value: any): void;
};
type Ref = React.MutableRefObject<any>;
type Fn = (...args: any[]) => any;

interface Deps {
  isExpanded: boolean;
  isUserMicSpeaker: Fn;
  setIsConnected: Setter;
  setIsExpanded: Setter;
  setIsInterviewerSpeaking: Setter;
  setIsProcessing: Setter;
  setIsUserSpeaking: Setter;
  setManualTranscript: Setter;
  setMessages: Setter;
  setRollingCommitted: Setter;
  setRollingLive: Setter;
  setUserRollingCommitted: Setter;
  setUserRollingLive: Setter;
  setVoiceInput: Setter;
  activeListeningEnabledRef: Ref;
  answerSttHadSpeechRef: Ref;
  answerSttLastActivityRef: Ref;
  autoSuggestEnabledRef: Ref;
  handleWhatToSayRef: Ref;
  isProcessingRef: Ref;
  isRecordingRef: Ref;
  lastAutoSuggestAtRef: Ref;
  manualTranscriptRef: Ref;
  rollingLiveRef: Ref;
  userRollingLiveRef: Ref;
  voiceInputRef: Ref;
  commitRollingWithLive: Fn;
  hasInterviewerQuestionSignal: Fn;
  queueToken: Fn;
  flushToken: Fn;
  AUTO_SUGGEST_COOLDOWN_MS: number;
}

/** Live-meeting listeners: native audio status + transcripts + intelligence updates. Verbatim relocation (deps array unchanged). */
export function useLiveMeetingListeners(deps: Deps) {
  const {
    isExpanded,
    isUserMicSpeaker,
    setIsConnected,
    setIsExpanded,
    setIsInterviewerSpeaking,
    setIsProcessing,
    setIsUserSpeaking,
    setManualTranscript,
    setMessages,
    setRollingCommitted,
    setRollingLive,
    setUserRollingCommitted,
    setUserRollingLive,
    setVoiceInput,
    activeListeningEnabledRef,
    answerSttHadSpeechRef,
    answerSttLastActivityRef,
    autoSuggestEnabledRef,
    handleWhatToSayRef,
    isProcessingRef,
    isRecordingRef,
    lastAutoSuggestAtRef,
    manualTranscriptRef,
    rollingLiveRef,
    userRollingLiveRef,
    voiceInputRef,
    commitRollingWithLive,
    hasInterviewerQuestionSignal,
    queueToken,
    flushToken,
    AUTO_SUGGEST_COOLDOWN_MS,
  } = deps;

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // Connection Status
    window.electronAPI
      .getNativeAudioStatus()
      .then((status) => {
        setIsConnected(status.connected);
      })
      .catch(() => setIsConnected(false));

    cleanups.push(
      window.electronAPI.onNativeAudioConnected(() => {
        setIsConnected(true);
      }),
    );
    cleanups.push(
      window.electronAPI.onNativeAudioDisconnected(() => {
        setIsConnected(false);
      }),
    );

    // Real-time Transcripts
    cleanups.push(
      window.electronAPI.onNativeAudioTranscript((transcript) => {
        if (
          transcript.final &&
          transcript.text?.trim() &&
          window.electronAPI?.appendMeetingTranscript
        ) {
          void window.electronAPI
            .appendMeetingTranscript({
              speaker: transcript.speaker,
              text: transcript.text.trim(),
              timestamp: Date.now(),
            })
            .catch(() => {});
        }

        // When Answer button is active, capture USER transcripts for voice input
        // Use ref to avoid stale closure issue
        if (isUserMicSpeaker(transcript.speaker)) {
          if (transcript.text?.trim()) {
            setIsUserSpeaking(!transcript.final);
            if (transcript.final) {
              setUserRollingCommitted((prev) =>
                commitRollingWithLive(
                  prev,
                  userRollingLiveRef.current,
                  transcript.text,
                ),
              );
              userRollingLiveRef.current = "";
              setUserRollingLive("");
              setTimeout(() => {
                setIsUserSpeaking(false);
              }, 3000);
            } else {
              userRollingLiveRef.current = transcript.text;
              setUserRollingLive(transcript.text);
            }
          }

          if (isRecordingRef.current) {
            if (transcript.text?.trim()) {
              answerSttLastActivityRef.current = Date.now();
              answerSttHadSpeechRef.current = true;
            }
            if (transcript.final) {
              // Accumulate final transcripts
              setVoiceInput((prev) => {
                const updated = prev + (prev ? " " : "") + transcript.text;
                voiceInputRef.current = updated;
                return updated;
              });
              setManualTranscript(""); // Clear partial preview
              manualTranscriptRef.current = "";
            } else {
              // Show live partial transcript
              setManualTranscript(transcript.text);
              manualTranscriptRef.current = transcript.text;
            }
            return; // Don't add to messages while recording
          }

          return;
        }

        // Only interviewer (system audio) transcripts below
        if (transcript.speaker !== "interviewer") {
          return; // Safety check for any other speaker types
        }

        // Route to rolling transcript bar - accumulate text continuously
        setIsInterviewerSpeaking(!transcript.final);

        if (transcript.final) {
          setRollingCommitted((prev) =>
            commitRollingWithLive(
              prev,
              rollingLiveRef.current,
              transcript.text,
            ),
          );
          rollingLiveRef.current = "";
          setRollingLive("");

          if (
            activeListeningEnabledRef.current &&
            autoSuggestEnabledRef.current &&
            transcript.text?.trim() &&
            hasInterviewerQuestionSignal(transcript.text) &&
            !isProcessingRef.current &&
            Date.now() - lastAutoSuggestAtRef.current >=
              AUTO_SUGGEST_COOLDOWN_MS
          ) {
            lastAutoSuggestAtRef.current = Date.now();
            void handleWhatToSayRef.current(undefined, {
              question: transcript.text.trim(),
            });
          }

          // Clear speaking indicator after pause
          setTimeout(() => {
            setIsInterviewerSpeaking(false);
          }, 3000);
        } else {
          rollingLiveRef.current = transcript.text;
          setRollingLive(transcript.text);
        }
      }),
    );

    // AI Suggestions from native audio (legacy)
    cleanups.push(
      window.electronAPI.onSuggestionProcessingStart(() => {
        setIsProcessing(true);
        setIsExpanded(true);
      }),
    );

    cleanups.push(
      window.electronAPI.onSuggestionGenerated((data) => {
        setIsProcessing(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            text: data.suggestion,
          },
        ]);
      }),
    );

    cleanups.push(
      window.electronAPI.onSuggestionError((err) => {
        setIsProcessing(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            text: `Error: ${err.error}`,
          },
        ]);
      }),
    );

    cleanups.push(
      window.electronAPI.onIntelligenceSuggestedAnswerToken((data) => {
        // Coaching now arrives via onIntelligenceNegotiationCoaching only —
        // sentinel detection on this stream has been removed.
        queueToken("what_to_answer", data.token);
      }),
    );

    cleanups.push(
      window.electronAPI.onIntelligenceSuggestedAnswer((data) => {
        // PERF: flush any tokens still pending in the rAF buffer onto the
        // streaming row BEFORE we apply the final-answer setMessages, so no
        // tokens are lost on stream completion.
        flushToken();
        setIsProcessing(false);

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.isStreaming &&
            lastMsg.intent === "what_to_answer"
          ) {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...lastMsg,
              text: data.answer,
              isStreaming: false,
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: data.answer,
              intent: "what_to_answer",
            },
          ];
        });
      }),
    );

    // Sprint 9: time-batched token channel — single subscription that
    // unrolls a kind-tagged items array onto the existing queueToken path.
    // The 5 per-token channels (intelligence-suggested-answer-token,
    // intelligence-refined-answer-token, etc.) are no longer being sent
    // by main.ts for these streams — their handlers above are now inert
    // safety nets and only fire if some other code path emits them.
    cleanups.push(
      window.electronAPI.onIntelligenceTokenBatch((data) => {
        const { kind, items } = data;
        if (!items || items.length === 0) return;
        if (kind === "suggested_answer") {
          for (const it of items)
            queueToken("what_to_answer", (it as any).token);
        } else if (kind === "refined_answer") {
          for (const it of items)
            queueToken((it as any).intent, (it as any).token);
        } else if (kind === "recap") {
          for (const it of items) queueToken("recap", (it as any).token);
        } else if (kind === "clarify") {
          for (const it of items) queueToken("clarify", (it as any).token);
        } else if (kind === "follow_up_questions") {
          for (const it of items)
            queueToken("follow_up_questions", (it as any).token);
        }
      }),
    );

    // Sprint 7: dedicated negotiation-coaching channel.
    // The engine now intercepts the coaching sentinel server-side and
    // emits this event INSTEAD of suggested_answer / suggested_answer_token.
    // Renderer no longer needs JSON.parse-per-token detection (the
    // existing prefix-gated detection paths above are kept as defense-
    // in-depth — they are inert because the engine never sends sentinel
    // tokens through suggested_answer anymore).
    cleanups.push(
      window.electronAPI.onIntelligenceNegotiationCoaching((data) => {
        // Flush any pending streamed tokens before swapping the streaming
        // row to a coaching card; otherwise rAF-buffered text would be
        // appended onto the card row's empty text after this setMessages.
        flushToken();
        setIsProcessing(false);
        const coaching = data.payload;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          // If a what_to_answer streaming row is in flight, replace it
          // with the coaching card so the user doesn't see two bubbles.
          if (
            lastMsg &&
            lastMsg.isStreaming &&
            lastMsg.intent === "what_to_answer"
          ) {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...lastMsg,
              text: "",
              isStreaming: false,
              isNegotiationCoaching: true,
              negotiationCoachingData: coaching,
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: "",
              intent: "what_to_answer",
              isNegotiationCoaching: true,
              negotiationCoachingData: coaching,
            },
          ];
        });
      }),
    );

    // STREAMING: Refinement
    cleanups.push(
      window.electronAPI.onIntelligenceRefinedAnswerToken((data) => {
        // PERF: rAF-coalesce per-token state updates.
        queueToken(data.intent, data.token);
      }),
    );

    cleanups.push(
      window.electronAPI.onIntelligenceRefinedAnswer((data) => {
        flushToken();
        setIsProcessing(false);
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.isStreaming &&
            lastMsg.intent === data.intent
          ) {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...lastMsg,
              text: data.answer,
              isStreaming: false,
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: data.answer,
              intent: data.intent,
            },
          ];
        });
      }),
    );

    // STREAMING: Recap
    cleanups.push(
      window.electronAPI.onIntelligenceRecapToken((data) => {
        queueToken("recap", data.token);
      }),
    );

    cleanups.push(
      window.electronAPI.onIntelligenceRecap((data) => {
        flushToken();
        setIsProcessing(false);
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.isStreaming && lastMsg.intent === "recap") {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...lastMsg,
              text: data.summary,
              isStreaming: false,
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: data.summary,
              intent: "recap",
            },
          ];
        });
      }),
    );

    // STREAMING: Follow-Up Questions (Rendered as message? Or specific UI?)
    // Currently interface typically renders follow-up Qs as a message or button update.
    // Let's assume message for now based on existing 'follow_up_questions_update' handling
    // But wait, existing handle just sets state?
    // Let's check how 'follow_up_questions_update' was handled.
    // It was handled separate locally in this component maybe?
    // Ah, I need to see the existing listener for 'onIntelligenceFollowUpQuestionsUpdate'

    // Let's implemented token streaming for it anyway, likely it updates a message bubble
    // OR it might update a specialized "Suggested Questions" area.
    // Assuming it's a message for consistency with "Copilot" approach.

    cleanups.push(
      window.electronAPI.onIntelligenceFollowUpQuestionsToken((data) => {
        queueToken("follow_up_questions", data.token);
      }),
    );

    cleanups.push(
      window.electronAPI.onIntelligenceFollowUpQuestionsUpdate((data) => {
        flushToken();
        // This event name is slightly different ('update' vs 'answer')
        setIsProcessing(false);
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.isStreaming &&
            lastMsg.intent === "follow_up_questions"
          ) {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...lastMsg,
              text: data.questions,
              isStreaming: false,
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: data.questions,
              intent: "follow_up_questions",
            },
          ];
        });
      }),
    );

    cleanups.push(
      window.electronAPI.onIntelligenceManualResult((data) => {
        setIsProcessing(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            text: `🎯 **Answer:**\n\n${data.answer}`,
          },
        ]);
      }),
    );

    cleanups.push(
      window.electronAPI.onIntelligenceError((data) => {
        setIsProcessing(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            text: `❌ Error (${data.mode}): ${data.error}`,
          },
        ]);
      }),
    );
    return () => cleanups.forEach((fn) => fn());
  }, [isExpanded]);
}
