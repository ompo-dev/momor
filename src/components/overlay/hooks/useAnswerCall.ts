import React, { useCallback } from "react";
import { shouldUseAgentSession } from "../../../lib/localPathDetection";

type ArraySetter = { (updater: (prev: any[]) => any): void; (value: any): void };
type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;
type Fn = (...args: any[]) => any;

interface Deps {
  setMessages: ArraySetter;
  setAttachedContext: ArraySetter;
  setInputValue: Setter;
  setIsExpanded: Setter;
  setIsManualRecording: Setter;
  setIsProcessing: Setter;
  setManualTranscript: Setter;
  setVoiceInput: Setter;
  setActiveListeningSessionActive: Setter;
  activeListeningEnabledRef: Ref;
  answerAutoFinishRef: Ref;
  answerCallSessionActiveRef: Ref;
  answerSttHadSpeechRef: Ref;
  answerSttLastActivityRef: Ref;
  applyActiveListeningOnMeetingStartRef: Ref;
  finishAnswerNowTurnRef: Ref;
  handleAnswerNowRef: Ref;
  handleManualSubmitRef: Ref;
  isRecordingRef: Ref;
  manualTranscriptRef: Ref;
  messagesEndRef: Ref;
  requestStartTimeRef: Ref;
  resumeAnswerCallListeningRef: Ref;
  startAnswerNowListeningRef: Ref;
  tokenBufRef: Ref;
  voiceInputRef: Ref;
  flushToken: Fn;
  syncAnswerCallSession: Fn;
  refreshProfileListeningRefs: Fn;
  enrichSystemPromptWithUserContext: Fn;
  getActiveAiProfileId: Fn;
  loadUserSessionData: Fn;
  mergeConversationContextWithUserSession: Fn;
  analytics: any;
  conversationContext: any;
  currentModel: string;
  inputValue: any;
  isCallMode: any;
  isConnected: any;
  isManualRecording: any;
  sttNotConfigured: any;
  sttUserError: any;
  sttUserStatus: any;
  attachedContext: any[];
}

function buildAgentOverlaySystemPrompt(
  fullContext: string,
  hasImages: boolean,
  explicitLocalPath = false,
): string {
  const parts = [
    "You are momor, a helpful AI assistant developed by ompo-dev.",
    "Answer directly. Use markdown when it helps readability.",
    "This overlay composer is a real agentic session with filesystem, MCP, skill, and shell tools available.",
    "Use the available filesystem, MCP, skill, and shell tools whenever the request is about local files, folders, code, paths, or project state.",
    "If the user asks what a specific local file or folder contains, inspect the real target before answering.",
    "Do not answer file-content questions from memory, prior context, or guesswork. Read the target first.",
    "When the user references an absolute local path, treat that path as intentionally shared for this turn and inspect it before answering.",
    "If a referenced file was already read successfully, answer from that real file content instead of asking the user to paste it again.",
    "When the user asks to create, edit, rename, move, or delete local files, perform the action directly with tools when allowed.",
    "Do not claim you lack access unless a tool call actually fails.",
    explicitLocalPath
      ? "This turn is specifically about an explicit local path. Prioritize the referenced file or folder over unrelated meeting or profile context."
      : "",
    hasImages
      ? "If images are attached, inspect them before answering."
      : "",
    !explicitLocalPath && fullContext?.trim()
      ? `<conversation-context>\n${fullContext}\n</conversation-context>`
      : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

function resolveOverlayAgentModel(currentModel: string): string | undefined {
  const model = String(currentModel ?? "").trim();
  if (!model) return undefined;
  if (model === "agent-cli" || model.startsWith("agent-cli:")) return undefined;
  if (model === "codex-cli") return undefined;
  if (model.startsWith("codex-cli:")) {
    const mapped = model.slice("codex-cli:".length).trim();
    return mapped || undefined;
  }
  return model;
}

/** Answer-call + brainstorm + manual-submit subsystem. Verbatim bodies relocated from MomorInterface; returns the 3 externally-used handlers (rest wired via refs). */
export function useAnswerCall({
  setMessages,
  setAttachedContext,
  setInputValue,
  setIsExpanded,
  setIsManualRecording,
  setIsProcessing,
  setManualTranscript,
  setVoiceInput,
  setActiveListeningSessionActive,
  activeListeningEnabledRef,
  answerAutoFinishRef,
  answerCallSessionActiveRef,
  answerSttHadSpeechRef,
  answerSttLastActivityRef,
  applyActiveListeningOnMeetingStartRef,
  finishAnswerNowTurnRef,
  handleAnswerNowRef,
  handleManualSubmitRef,
  isRecordingRef,
  manualTranscriptRef,
  messagesEndRef,
  requestStartTimeRef,
  resumeAnswerCallListeningRef,
  startAnswerNowListeningRef,
  tokenBufRef,
  voiceInputRef,
  flushToken,
  syncAnswerCallSession,
  refreshProfileListeningRefs,
  enrichSystemPromptWithUserContext,
  getActiveAiProfileId,
  loadUserSessionData,
  mergeConversationContextWithUserSession,
  analytics,
  conversationContext,
  currentModel,
  inputValue,
  isCallMode,
  isConnected,
  isManualRecording,
  sttNotConfigured,
  sttUserError,
  sttUserStatus,
  attachedContext,
}: Deps) {
  const handleBrainstorm = async () => {
    setIsExpanded(true);
    setIsProcessing(true);
    analytics.trackCommandExecuted("brainstorm");

    const currentAttachments = attachedContext;
    if (currentAttachments.length > 0) {
      setAttachedContext([]);
      // Show the attached image in chat
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          text: "Brainstorm with this context",
          hasScreenshot: true,
          screenshotPreview: currentAttachments[0].preview,
        },
      ]);
      // Scroll to bottom when user sends message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }

    try {
      await window.electronAPI.generateBrainstorm(
        currentAttachments.length > 0
          ? currentAttachments.map((s) => s.path)
          : undefined,
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          text: `Error: ${err}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Setup Streaming Listeners

  const resumeAnswerCallListening = useCallback(async () => {
    answerAutoFinishRef.current = false;
    answerSttHadSpeechRef.current = false;
    answerSttLastActivityRef.current = Date.now();
    setVoiceInput("");
    voiceInputRef.current = "";
    setManualTranscript("");
    manualTranscriptRef.current = "";
    isRecordingRef.current = true;
    setIsManualRecording(true);
  }, [syncAnswerCallSession]);

  const startAnswerNowListening = useCallback(async () => {
    setVoiceInput("");
    voiceInputRef.current = "";
    setManualTranscript("");
    manualTranscriptRef.current = "";
    answerAutoFinishRef.current = false;
    answerSttHadSpeechRef.current = false;
    answerSttLastActivityRef.current = Date.now();
    isRecordingRef.current = true;
    setIsManualRecording(true);

    if (sttNotConfigured) {
      isRecordingRef.current = false;
      setIsManualRecording(false);
      syncAnswerCallSession(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          text: "⚠️ Speech-to-text is not configured. Select a provider and save an API key in Settings.",
        },
      ]);
      return;
    }

    try {
      const startResult =
        await (window.electronAPI.startAnswerNowMic() as Promise<any>);
      if (
        startResult &&
        typeof startResult === "object" &&
        startResult.success === false
      ) {
        throw new Error(startResult.error || "failed_to_start_stt_capture");
      }
    } catch (err) {
      console.error("[MomorInterface] Failed to start Answer Now mic:", err);
      isRecordingRef.current = false;
      setIsManualRecording(false);
      syncAnswerCallSession(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          text: "⚠️ Could not start microphone capture. Check your microphone permission and STT provider settings.",
        },
      ]);
    }
  }, [isConnected, sttNotConfigured, syncAnswerCallSession]);

  const applyActiveListeningOnMeetingStart = useCallback(async () => {
    refreshProfileListeningRefs();
    if (!activeListeningEnabledRef.current) {
      setActiveListeningSessionActive(false);
      return;
    }
    setActiveListeningSessionActive(true);
  }, [refreshProfileListeningRefs]);
  applyActiveListeningOnMeetingStartRef.current =
    applyActiveListeningOnMeetingStart;




  const finishAnswerNowTurn = useCallback(
    async (resumeAfter = false) => {
      if (!isRecordingRef.current) {
        answerAutoFinishRef.current = false;
        return;
      }

      isRecordingRef.current = false;
      setIsManualRecording(false);
      answerAutoFinishRef.current = false;
      setManualTranscript("");

      window.electronAPI
        ?.finalizeMicSTT?.()
        .catch((err) =>
          console.error("[MomorInterface] Failed to send finalizeMicSTT:", err),
        );

      if (!isConnected) {
        window.electronAPI
          ?.stopAnswerNowMic?.()
          .catch((err) =>
            console.error(
              "[MomorInterface] Failed to stop Answer Now mic:",
              err,
            ),
          );
      }

      const currentAttachments = attachedContext;
      setAttachedContext([]);

      let question = (
        voiceInputRef.current +
        (manualTranscriptRef.current ? " " + manualTranscriptRef.current : "")
      ).trim();
      setVoiceInput("");
      voiceInputRef.current = "";
      setManualTranscript("");
      manualTranscriptRef.current = "";

      if (!question && currentAttachments.length === 0) {
        if (resumeAfter) {
          await resumeAnswerCallListening();
          return;
        }
        if (!isConnected) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: "⚠️ Speech-to-text backend is not connected. Open Settings > Speech-to-Text and verify provider/API key.",
            },
          ]);
        } else if (sttNotConfigured) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: "⚠️ Speech-to-text is not configured. Select a provider and save an API key in Settings.",
            },
          ]);
        } else if (sttUserStatus === "failed" && sttUserError) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: `❌ STT Error: ${sttUserError}`,
            },
          ]);
        } else if (sttUserStatus === "reconnecting") {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: "⏳ STT is reconnecting, try again in a moment.",
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: "⚠️ No speech detected. Try speaking closer to your microphone.",
            },
          ]);
        }
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          text: question,
          hasScreenshot: currentAttachments.length > 0,
          screenshotPreview: currentAttachments[0]?.preview,
        },
      ]);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          text: "",
          isStreaming: true,
        },
      ]);

      setIsProcessing(true);

      try {
        let prompt = "";

        if (currentAttachments.length > 0) {
          prompt = `You are a helper. The user has provided a screenshot and a spoken question/command.
User said: "${question}"

Instructions:
1. Analyze the screenshot in the context of what the user said.
2. Provide a direct, helpful answer.
3. Be concise.`;
        } else {
          const ragResult = await window.electronAPI.ragQueryLive?.(question);
          if (ragResult?.success) {
            if (resumeAfter) {
              await resumeAnswerCallListening();
            }
            return;
          }

          prompt = `You are a real-time interview assistant. The user just repeated or paraphrased a question from their interviewer.
Instructions:
1. Extract the core question being asked
2. Provide a clear, concise, and professional answer that the user can say out loud
3. Keep the answer conversational but informative (2-4 sentences ideal)
4. Do NOT include phrases like "The question is..." - just give the answer directly
5. Format for speaking out loud, not for reading

Provide only the answer, nothing else.`;
        }

        requestStartTimeRef.current = Date.now();
        const sessionData = loadUserSessionData();
        const activeProfileId = getActiveAiProfileId();
        prompt = enrichSystemPromptWithUserContext(
          prompt,
          sessionData,
          activeProfileId,
        );
        await window.electronAPI.streamGeminiChat(
          question,
          currentAttachments.length > 0
            ? currentAttachments.map((s) => s.path)
            : undefined,
          prompt,
          { skipSystemPrompt: true },
        );
      } catch (err) {
        setIsProcessing(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.isStreaming && last.text === "") {
            return prev.slice(0, -1).concat({
              id: Date.now().toString(),
              role: "system",
              text: `❌ Error starting stream: ${err}`,
            });
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: `❌ Error: ${err}`,
            },
          ];
        });
        return;
      }

      if (resumeAfter) {
        await resumeAnswerCallListening();
      }
    },
    [
      attachedContext,
      isConnected,
      resumeAnswerCallListening,
      sttNotConfigured,
      sttUserError,
      sttUserStatus,
    ],
  );

  resumeAnswerCallListeningRef.current = resumeAnswerCallListening;
  startAnswerNowListeningRef.current = startAnswerNowListening;
  finishAnswerNowTurnRef.current = finishAnswerNowTurn;

  const handleAnswerNow = async () => {
    if (isCallMode) {
      if (answerCallSessionActiveRef.current) {
        syncAnswerCallSession(false);
        isRecordingRef.current = false;
        setIsManualRecording(false);
        answerAutoFinishRef.current = false;
        if (!isConnected) {
          window.electronAPI?.stopAnswerNowMic?.().catch(() => undefined);
        }
        return;
      }

      syncAnswerCallSession(true);
      await startAnswerNowListening();
      return;
    }

    if (isManualRecording) {
      await finishAnswerNowTurn(false);
    } else {
      await startAnswerNowListening();
    }
  };
  handleAnswerNowRef.current = handleAnswerNow;

  const handleManualSubmit = async () => {
    if (!inputValue.trim() && attachedContext.length === 0) return;

    const userText = inputValue;
    const currentAttachments = attachedContext;

    // Clear inputs immediately
    setInputValue("");
    setAttachedContext([]);

    // Seal any in-flight streaming rows from a previous turn before we
    // append the new user message + placeholder. Without this, the rAF
    // token coalescer (queueToken) can append tokens of the next stream
    // onto the prior row whenever the streaming intent matches —
    // surfacing as the next answer starting mid-sentence with leftover
    // text from the previous turn. Also flush any tokens still pending
    // in the rAF buffer so they land on the prior row, not the new one.
    flushToken();
    tokenBufRef.current.intent = "";
    tokenBufRef.current.text = "";
    if (tokenBufRef.current.raf !== null) {
      cancelAnimationFrame(tokenBufRef.current.raf);
      tokenBufRef.current.raf = null;
    }
    setMessages((prev) =>
      prev.some((m) => m.isStreaming)
        ? prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
        : prev,
    );

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        text:
          userText ||
          (currentAttachments.length > 0 ? "Analyze this screenshot" : ""),
        hasScreenshot: currentAttachments.length > 0,
        screenshotPreview: currentAttachments[0]?.preview,
      },
    ]);

    // Scroll to bottom when user sends message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    // Add placeholder for streaming response
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "system",
        text: "",
        isStreaming: true,
      },
    ]);

    setIsExpanded(true);
    setIsProcessing(true);

    try {
      // JIT RAG pre-flight: try to use indexed meeting context first, but
      // never swallow turns that clearly need the real agent session.
      const shouldUseAgentDirectly = shouldUseAgentSession(userText || "");

      if (currentAttachments.length === 0 && !shouldUseAgentDirectly) {
        const ragResult = await window.electronAPI.ragQueryLive?.(
          userText || "",
        );
        if (ragResult?.success) {
          // JIT RAG handled it — response streamed via rag:stream-chunk events
          return;
        }
      }

      // Pass imagePath if attached, AND conversation context
      requestStartTimeRef.current = Date.now();
      const sessionData = loadUserSessionData();
      const activeProfileId = getActiveAiProfileId();
      const fullContext = mergeConversationContextWithUserSession(
        conversationContext,
        sessionData,
        activeProfileId,
      );
      const imagePaths =
        currentAttachments.length > 0
          ? currentAttachments.map((s) => s.path)
          : undefined;

      if (window.electronAPI.agentChatStream) {
        await window.electronAPI.agentChatStream({
          message: userText || "Analyze this screenshot",
          provider: "openclaude",
          model: resolveOverlayAgentModel(currentModel),
          imagePaths,
          systemPrompt: buildAgentOverlaySystemPrompt(
            fullContext,
            currentAttachments.length > 0,
            shouldUseAgentDirectly,
          ),
        });
      } else {
        await window.electronAPI.streamGeminiChat(
          userText || "Analyze this screenshot",
          imagePaths,
          fullContext,
        );
      }
    } catch (err) {
      setIsProcessing(false);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.isStreaming && last.text === "") {
          // remove the empty placeholder
          return prev.slice(0, -1).concat({
            id: Date.now().toString(),
            role: "system",
            text: `❌ Error starting stream: ${err}`,
          });
        }
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            text: `❌ Error: ${err}`,
          },
        ];
      });
    }
  };

  // Refresh the latest-handler ref on every render so the captured-key
  // listener (mounted with [] deps) calls the CURRENT closure, not a
  // stale snapshot from first render.
  handleManualSubmitRef.current = handleManualSubmit;

  return { handleBrainstorm, handleAnswerNow, handleManualSubmit };
}
