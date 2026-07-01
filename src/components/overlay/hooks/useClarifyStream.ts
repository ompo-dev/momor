import { useEffect } from "react";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Fn = (...args: any[]) => any;

/** Intelligence "clarify" token + final listeners (survive isExpanded). Verbatim relocation (deps array unchanged). */
export function useClarifyStream({
  queueToken,
  flushToken,
  setIsProcessing,
  setMessages,
}: {
  queueToken: Fn;
  flushToken: Fn;
  setIsProcessing: Setter;
  setMessages: Setter;
}) {
  useEffect(() => {
    const cleanupToken = window.electronAPI.onIntelligenceClarifyToken(
      (data) => {
        queueToken("clarify", data.token);
      },
    );

    const cleanupFinal = window.electronAPI.onIntelligenceClarify((data) => {
      flushToken();
      setIsProcessing(false);
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.isStreaming && lastMsg.intent === "clarify") {
          const updated = [...prev];
          updated[prev.length - 1] = {
            ...lastMsg,
            text: data.clarification,
            isStreaming: false,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system" as const,
            text: data.clarification,
            intent: "clarify",
          },
        ];
      });
    });

    return () => {
      cleanupToken();
      cleanupFinal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — these listeners must survive isExpanded changes
}
