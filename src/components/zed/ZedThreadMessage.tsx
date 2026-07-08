import * as React from "react";
import { cn } from "@/lib/utils";

// Port of Zed's agent conversation turns (crates/agent_ui/conversation_view).
// Zed's thread is a flowing DOCUMENT, not bubble chat:
//   • user turn   → a quiet bordered block (element bg) holding the prompt
//   • agent turn  → flat rendered markdown, no bubble, optional role caption
// This is what makes Zed's AI panel read cleaner than typical chat UIs.

export type ZedThreadRole = "user" | "agent";

export interface ZedThreadMessageProps {
  role: ZedThreadRole;
  /** Small caption above the content (e.g. "You", "Agent", model name). */
  label?: React.ReactNode;
  /** Right-aligned actions revealed on hover (copy, retry…). */
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function ZedThreadMessage({
  role,
  label,
  actions,
  className,
  children,
}: ZedThreadMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("group/msg w-full", className)}>
      {(label || actions) && (
        <div className="mb-1 flex items-center justify-between gap-2">
          {label ? (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
          ) : (
            <span />
          )}
          {actions ? (
            <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
              {actions}
            </span>
          ) : null}
        </div>
      )}

      {isUser ? (
        <div className="rounded-sm border border-border-subtle/80 bg-background/45 px-3 py-2.5 text-[12.5px] leading-6 text-foreground">
          {children}
        </div>
      ) : (
        <div className="px-0.5 text-[12.5px] leading-6 text-foreground [&_a]:text-primary [&_code]:rounded-sm [&_code]:bg-secondary/75 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11.5px]">
          {children}
        </div>
      )}
    </div>
  );
}
