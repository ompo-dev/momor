import React from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

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

/** Chips showing which agent tools or skills ran this turn. */
export default function AgentToolChips({
  tools,
  pillBaseClass,
  toneClass,
}: Props) {
  const { t } = useTranslation();
  void pillBaseClass;
  if (tools.length === 0) return null;

  return (
    <div className="no-drag mx-auto flex w-full max-w-[680px] flex-wrap items-center gap-1 px-5 pt-2">
      {tools.map((tool) => (
        <div
          key={tool.toolId}
          className={`inline-flex h-5 items-center gap-1 rounded-[8px] border border-border-subtle/80 bg-background/18 px-1.5 ${
            tool.isError
              ? toneClass("error")
              : tool.done
                ? toneClass("ok")
                : "overlay-text-secondary"
          }`}
          title={
            tool.done
              ? tool.isError
                ? `${tool.name} failed`
                : `${tool.name} done`
              : t("overlay.toolActivity")
          }
        >
          {tool.done ? (
            tool.isError ? (
              <X className="h-3 w-3 opacity-70" />
            ) : (
              <Check className="h-3 w-3 opacity-70" />
            )
          ) : (
            <RefreshCw className="h-3 w-3 animate-spin opacity-70" />
          )}
          <span className="max-w-[180px] truncate font-mono text-[9.5px] uppercase tracking-[0.08em]">
            {tool.name}
          </span>
        </div>
      ))}
    </div>
  );
}
