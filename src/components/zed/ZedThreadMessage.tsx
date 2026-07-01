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
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
        <div className="rounded-md border border-border bg-secondary px-3 py-2 text-[13px] leading-relaxed text-foreground">
          {children}
        </div>
      ) : (
        <div className="text-[13px] leading-relaxed text-foreground [&_a]:text-primary [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]">
          {children}
        </div>
      )}
    </div>
  );
}
