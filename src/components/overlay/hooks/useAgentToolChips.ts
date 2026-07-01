import React, { useEffect } from "react";

type Setter = { (updater: (prev: any[]) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface Deps {
  setAgentTools: Setter;
}

/** Surface agent tool-use (skills/MCP) as chips. Verbatim. Relocated (deps array unchanged). */
export function useAgentToolChips({
  setAgentTools,
}: Deps) {
  useEffect(() => {
    const onCall = window.electronAPI?.onAgentToolCall?.((data) => {
      setAgentTools((prev) => {
        if (prev.some((t) => t.toolId === data.toolId)) return prev;
        return [
          ...prev.slice(-5),
          { toolId: data.toolId, name: data.name, done: false, isError: false },
        ];
      });
    });
    const onResult = window.electronAPI?.onAgentToolResult?.((data) => {
      setAgentTools((prev) =>
        prev.map((t) =>
          t.toolId === data.toolId
            ? { ...t, done: true, isError: !!data.isError }
            : t,
        ),
      );
    });
    return () => {
      onCall?.();
      onResult?.();
    };
  }, []);
}
