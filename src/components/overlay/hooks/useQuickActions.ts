import React, { useCallback } from "react";

type ArraySetter = { (updater: (prev: any[]) => any): void; (value: any): void };
type Setter = (value: any) => void;
type Ref = React.MutableRefObject<any>;

interface Deps {
  setMessages: ArraySetter;
  setAttachedContext: ArraySetter;
  setIsExpanded: Setter;
  setIsProcessing: Setter;
  setLatestUsedImageInput: Setter;
  setLatestVisionFailureReason: Setter;
  setLatestVisionModelUsed: Setter;
  setLatestVisionProviderUsed: Setter;
  setScreenContextStatus: Setter;
  handleWhatToSayRef: Ref;
  messagesEndRef: Ref;
  pendingCaptureRef: Ref;
  analytics: any;
  attachedContext: any[];
}

/** Quick-action handlers (copy / what-to-say / follow-up / recap / follow-up-questions / clarify / code-hint). Verbatim bodies; returns handlers for JSX + handlersRef wiring. */
export function useQuickActions({
  setMessages,
  setAttachedContext,
  setIsExpanded,
  setIsProcessing,
  setLatestUsedImageInput,
  setLatestVisionFailureReason,
  setLatestVisionModelUsed,
  setLatestVisionProviderUsed,
  setScreenContextStatus,
  handleWhatToSayRef,
  messagesEndRef,
  pendingCaptureRef,
  analytics,
  attachedContext,
}: Deps) {
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    analytics.trackCopyAnswer();
    // Optional: Trigger a small toast or state change for visual feedback
  }, []);

  const handleWhatToSay = async (
    promptInstruction?: string | React.MouseEvent,
    options?: { question?: string },
  ) => {
    const dynamicPromptInstruction =
      typeof promptInstruction === "string" ? promptInstruction : undefined;
    setIsExpanded(true);
    setIsProcessing(true);
    analytics.trackCommandExecuted("what_to_say");

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.isStreaming && last.intent === "what_to_answer") {
        return prev;
      }
      return [
        ...prev,
        {
          id: `what-to-answer-${Date.now()}`,
          role: "system",
          text: "",
          intent: "what_to_answer",
          isStreaming: true,
        },
      ];
    });

    // Capture and clear attached image context.
    // Also merge in any screenshot from the capture-and-process shortcut that
    // arrived via pendingCaptureRef before the React state flush (React 18 fix).
    const pending = pendingCaptureRef.current;
    let currentAttachments = attachedContext;
    if (pending && !currentAttachments.some((s) => s.path === pending.path)) {
      currentAttachments = [...currentAttachments, pending].slice(-5);
    }

    if (currentAttachments.length > 0) {
      setAttachedContext([]);
      // Show the attached image in chat
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          text: "What should I say about this?",
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
      // Pass imagePath if attached
      const result = await window.electronAPI.generateWhatToSay(
        options?.question,
        currentAttachments.length > 0
          ? currentAttachments.map((s) => s.path)
          : undefined,
        dynamicPromptInstruction
          ? { promptInstruction: dynamicPromptInstruction }
          : undefined,
      );
      setScreenContextStatus(result.screenContextStatus || "not_available");
      setLatestUsedImageInput(Boolean(result.usedImageInput));
      setLatestVisionProviderUsed(result.visionProviderUsed);
      setLatestVisionModelUsed(result.visionModelUsed);
      setLatestVisionFailureReason(result.visionFailureReason);
      if (!result.answer && !result.error) {
        setIsProcessing(false);
        setMessages((prev) =>
          prev.filter((m) => !(m.isStreaming && m.intent === "what_to_answer")),
        );
      }
    } catch (err) {
      setIsProcessing(false);
      setMessages((prev) => {
        const trimmed = prev.filter(
          (m) =>
            !(m.isStreaming && m.intent === "what_to_answer" && m.text === ""),
        );
        return [
          ...trimmed,
          {
            id: Date.now().toString(),
            role: "system",
            text: `Error: ${err}`,
          },
        ];
      });
    }
  };
  handleWhatToSayRef.current = handleWhatToSay;

  const handleFollowUp = async (intent: string = "rephrase") => {
    setIsExpanded(true);
    setIsProcessing(true);
    analytics.trackCommandExecuted("follow_up_" + intent);

    try {
      await window.electronAPI.generateFollowUp(intent);
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

  const handleRecap = async () => {
    setIsExpanded(true);
    setIsProcessing(true);
    analytics.trackCommandExecuted("recap");

    try {
      await window.electronAPI.generateRecap();
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

  const handleFollowUpQuestions = async () => {
    setIsExpanded(true);
    setIsProcessing(true);
    analytics.trackCommandExecuted("suggest_questions");

    try {
      await window.electronAPI.generateFollowUpQuestions();
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

  const handleClarify = async () => {
    setIsExpanded(true);
    setIsProcessing(true);
    analytics.trackCommandExecuted("clarify");

    try {
      await window.electronAPI.generateClarify();
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

  const handleCodeHint = async () => {
    setIsExpanded(true);
    setIsProcessing(true);
    analytics.trackCommandExecuted("code_hint");

    const currentAttachments = attachedContext;
    if (currentAttachments.length > 0) {
      setAttachedContext([]);
      // Show the attached image in chat
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          text: "Give me a code hint for this",
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
      await window.electronAPI.generateCodeHint(
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

  return {
    handleCopy,
    handleWhatToSay,
    handleFollowUp,
    handleRecap,
    handleFollowUpQuestions,
    handleClarify,
    handleCodeHint,
  };
}
