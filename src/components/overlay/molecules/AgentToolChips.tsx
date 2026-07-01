import React from "react";
import { Check, X, RefreshCw } from "lucide-react";

export interface AgentToolChip {
  toolId: string;
  name: string;
  done: boolean;
  isError: boolean;
}

type Props = {
  tools: AgentToolChip[];
  /** Base pill class from the overlay theme. */
  pillBaseClass: string;
  /** Maps a tone to its class. */
  toneClass: (tone: "ok" | "warn" | "error") => string;
};

/** Chips showing which agent tools/skills ran this turn (spinner → ✓ / ✗). */
export default function AgentToolChips({ tools, pillBaseClass, toneClass }: Props) {
  if (tools.length === 0) return null;
  return (
    <div className="no-drag flex flex-wrap items-center justify-center gap-1.5 px-4 pt-2.5">
      {tools.map((tool) => (
        <div
          key={tool.toolId}
          className={`${pillBaseClass} ${
            tool.isError
              ? toneClass("error")
              : tool.done
                ? toneClass("ok")
                : "overlay-text-primary"
          }`}
          title={
            tool.done
              ? tool.isError
                ? `${tool.name} failed`
                : `${tool.name} done`
              : `Running ${tool.name}…`
          }
        >
          {tool.done ? (
            tool.isError ? (
              <X className="h-3 w-3 opacity-70" />
            ) : (
              <Check className="h-3 w-3 opacity-70" />
            )
          ) : (
            <RefreshCw className="h-3 w-3 opacity-70 animate-spin" />
          )}
          <span className="font-mono text-[10px]">{tool.name}</span>
        </div>
      ))}
    </div>
  );
}
