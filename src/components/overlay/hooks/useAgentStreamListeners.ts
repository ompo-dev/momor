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

function normalizeStreamError(error: string): string {
  const raw = String(error ?? "").trim();
  if (!raw) return "Unknown error.";
  return raw.replace(/^\[?Error:\s*/i, "").replace(/\]$/, "").trim();
}

function humanizeStreamError(error: string): string {
  const normalized = normalizeStreamError(error);
  if (/spawn\s+ENAMETOOLONG/i.test(normalized)) {
    return "O agente local nao conseguiu iniciar o comando. Isso normalmente indica caminho invalido do agente ou configuracao inconsistente em Integracoes.";
  }
  if (/spawn\s+.+\s+ENOENT|failed to launch.+ENOENT|no executable found/i.test(normalized)) {
    return "O agente local nao foi encontrado. Revise o caminho do agente em Integracoes.";
  }
  if (/produced no output|no output/i.test(normalized)) {
    return "O agente local iniciou, mas o backend nao retornou resposta. Revise o provider/modelo configurado em Integracoes e tente novamente.";
  }
  return normalized;
}

/** Gemini/RAG stream listeners (token/done/error) + usage tracking. */
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

    const applyStreamToken = (token: string) => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.isStreaming && lastMsg.role === "system") {
          const updated = [...prev];
          updated[prev.length - 1] = {
            ...lastMsg,
            text: lastMsg.text + token,
            isCode:
              (lastMsg.text + token).includes("```") ||
              (lastMsg.text + token).includes("def ") ||
              (lastMsg.text + token).includes("function "),
          };
          return updated;
        }
        return prev;
      });
    };

    const finalizeStream = (fullText?: string) => {
      setIsProcessing(false);

      let latency = 0;
      if (requestStartTimeRef.current) {
        latency = Date.now() - requestStartTimeRef.current;
        requestStartTimeRef.current = null;
      }

      analytics.trackModelUsed({
        model_name: currentModel,
        provider_type: detectProviderType(currentModel),
        latency_ms: latency,
      });

      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.isStreaming && lastMsg.role === "system") {
          const authoritativeText =
            typeof fullText === "string" && fullText.trim().length > 0
              ? fullText
              : undefined;
          return [
            ...prev.slice(0, -1),
            {
              ...lastMsg,
              text:
                authoritativeText ??
                (lastMsg.text?.trim().length > 0
                  ? lastMsg.text
                  : (fullText ?? lastMsg.text)),
              isStreaming: false,
            },
          ];
        }
        return prev;
      });
    };

    const applyStreamError = (error: string) => {
      const normalized = humanizeStreamError(error);
      setIsProcessing(false);
      requestStartTimeRef.current = null;
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.isStreaming) {
          const updated = [...prev];
          updated[prev.length - 1] = {
            ...lastMsg,
            isStreaming: false,
            isError: true,
            text: lastMsg.text?.trim()
              ? `${lastMsg.text}\n\nError: ${normalized}`
              : `Error: ${normalized}`,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            isError: true,
            text: `Error: ${normalized}`,
          },
        ];
      });
    };

    cleanups.push(
      window.electronAPI.onGeminiStreamToken((token) => {
        applyStreamToken(token);
      }),
    );

    cleanups.push(
      window.electronAPI.onGeminiStreamDone(() => {
        finalizeStream();
      }),
    );

    cleanups.push(
      window.electronAPI.onGeminiStreamError((error) => {
        applyStreamError(error);
      }),
    );

    if (window.electronAPI.onAgentStreamError) {
      cleanups.push(
        window.electronAPI.onAgentStreamError((data) => {
          applyStreamError(data.error);
        }),
      );
    }

    if (window.electronAPI.onAgentStreamToken) {
      cleanups.push(
        window.electronAPI.onAgentStreamToken((token) => {
          applyStreamToken(token);
        }),
      );
    }

    if (window.electronAPI.onAgentStreamDone) {
      cleanups.push(
        window.electronAPI.onAgentStreamDone((data) => {
          finalizeStream(data.fullText);
        }),
      );
    }

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
  }, [currentModel]);
}
