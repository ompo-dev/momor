import React, { useCallback } from "react";

type ArraySetter = { (updater: (prev: any[]) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface Deps {
  setMessages: ArraySetter;
  tokenBufRef: Ref;
  reactStartTransition: (...args: any[]) => any;
}

/** RAF-batched streaming-token buffer (queueToken/flushToken). Verbatim; returns both. */
export function useTokenBuffer({ setMessages, tokenBufRef, reactStartTransition }: Deps) {
  const queueToken = useCallback((intent: string, token: string) => {
    const buf = tokenBufRef.current;
    // If the intent changed, flush the prior buffer immediately so we don't
    // append text from one stream onto another.
    if (buf.text && buf.intent !== intent) {
      const oldIntent = buf.intent;
      const oldText = buf.text;
      buf.text = "";
      if (buf.raf !== null) {
        cancelAnimationFrame(buf.raf);
        buf.raf = null;
      }
      reactStartTransition(() => {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.isStreaming && lastMsg.intent === oldIntent) {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...lastMsg,
              text: lastMsg.text + oldText,
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "system",
              text: oldText,
              intent: oldIntent,
              isStreaming: true,
            },
          ];
        });
      });
    }
    buf.intent = intent;
    buf.text += token;
    if (buf.raf === null) {
      buf.raf = requestAnimationFrame(() => {
        buf.raf = null;
        const text = buf.text;
        const i = buf.intent;
        buf.text = "";
        if (!text) return;
        reactStartTransition(() => {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.isStreaming && lastMsg.intent === i) {
              const updated = [...prev];
              updated[prev.length - 1] = {
                ...lastMsg,
                text: lastMsg.text + text,
              };
              return updated;
            }
            return [
              ...prev,
              {
                id: Date.now().toString(),
                role: "system",
                text,
                intent: i,
                isStreaming: true,
              },
            ];
          });
        });
      });
    }
  }, []);

  const flushToken = useCallback(() => {
    const buf = tokenBufRef.current;
    if (buf.raf !== null) {
      cancelAnimationFrame(buf.raf);
      buf.raf = null;
    }
    if (!buf.text) return;
    const text = buf.text;
    const intent = buf.intent;
    buf.text = "";
    // NOT wrapped in startTransition — flush is called synchronously
    // before a final-answer setMessages, and we want the trailing tokens
    // to be in DOM before the final state is committed (so React's batch
    // doesn't reorder them after the final). The ordering must hold.
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.isStreaming && lastMsg.intent === intent) {
        const updated = [...prev];
        updated[prev.length - 1] = { ...lastMsg, text: lastMsg.text + text };
        return updated;
      }
      return [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          text,
          intent,
          isStreaming: true,
        },
      ];
    });
  }, []);

  return { queueToken, flushToken };
}
