import React, { useEffect } from "react";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface Deps {
  setMessages: Setter;
  setIsProcessing: Setter;
  requestStartTimeRef: Ref;
  currentModel: any;
  analytics: any;
  detectProviderType: (...args: any[]) => any;
}

/** Gemini/RAG stream listeners (token/done/error) + usage tracking. Verbatim relocation (deps array unchanged). */
export function useAgentStreamListeners({
  setMessages,
  setIsProcessing,
  requestStartTimeRef,
  currentModel,
  analytics,
  detectProviderType,
}: Deps) {
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // Stream Token
    cleanups.push(
      window.electronAPI.onGeminiStreamToken((token) => {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.isStreaming && lastMsg.role === "system") {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...lastMsg,
              text: lastMsg.text + token,
              // re-check code status on every token? Expensive but needed for progressive highlighting
              isCode:
                (lastMsg.text + token).includes("```") ||
                (lastMsg.text + token).includes("def ") ||
                (lastMsg.text + token).includes("function "),
            };
            return updated;
          }
          return prev;
        });
      }),
    );

    // Stream Done
    cleanups.push(
      window.electronAPI.onGeminiStreamDone(() => {
        setIsProcessing(false);

        // Calculate latency if we have a start time
        let latency = 0;
        if (requestStartTimeRef.current) {
          latency = Date.now() - requestStartTimeRef.current;
          requestStartTimeRef.current = null;
        }

        // Track Usage
        analytics.trackModelUsed({
          model_name: currentModel,
          provider_type: detectProviderType(currentModel),
          latency_ms: latency,
        });

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.isStreaming && lastMsg.role === "system") {
            return [...prev.slice(0, -1), { ...lastMsg, isStreaming: false }];
          }
          return prev;
        });
      }),
    );

    // Stream Error
    cleanups.push(
      window.electronAPI.onGeminiStreamError((error) => {
        setIsProcessing(false);
        requestStartTimeRef.current = null; // Clear timer on error
        setMessages((prev) => {
          // Append error to the current message or add new one?
          // Let's add a new error block if the previous one confusing,
          // or just update status.
          // Ideally we want to show the partial response AND the error.
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.isStreaming) {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...lastMsg,
              isStreaming: false,
              text: lastMsg.text + `\n\n[Error: ${error}]`,
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: `❌ Error: ${error}`,
            },
          ];
        });
      }),
    );

    // JIT RAG Stream listeners (for live meeting RAG responses)
    if (window.electronAPI.onRAGStreamChunk) {
      cleanups.push(
        window.electronAPI.onRAGStreamChunk((data: { chunk: string }) => {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.isStreaming && lastMsg.role === "system") {
              const updated = [...prev];
              updated[prev.length - 1] = {
                ...lastMsg,
                text: lastMsg.text + data.chunk,
                isCode: (lastMsg.text + data.chunk).includes("```"),
              };
              return updated;
            }
            return prev;
          });
        }),
      );
    }

    if (window.electronAPI.onRAGStreamComplete) {
      cleanups.push(
        window.electronAPI.onRAGStreamComplete(() => {
          setIsProcessing(false);
          requestStartTimeRef.current = null;
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.isStreaming && lastMsg.role === "system") {
              return [...prev.slice(0, -1), { ...lastMsg, isStreaming: false }];
            }
            if (lastMsg && lastMsg.isStreaming) {
              const updated = [...prev];
              updated[prev.length - 1] = { ...lastMsg, isStreaming: false };
              return updated;
            }
            return prev;
          });
        }),
      );
    }

    if (window.electronAPI.onRAGStreamError) {
      cleanups.push(
        window.electronAPI.onRAGStreamError((data: { error: string }) => {
          setIsProcessing(false);
          requestStartTimeRef.current = null;
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.isStreaming) {
              const updated = [...prev];
              updated[prev.length - 1] = {
                ...lastMsg,
                isStreaming: false,
                text: lastMsg.text + `\n\n[RAG Error: ${data.error}]`,
              };
              return updated;
            }
            return prev;
          });
        }),
      );
    }

    return () => cleanups.forEach((fn) => fn());
  }, [currentModel]); // Ensure tracking captures correct model
}
