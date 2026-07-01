import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZedIconButton } from "./ZedIconButton";

// Port of Zed's agent message composer (crates/agent_ui/message_editor.rs):
// one cohesive box holding the editor + an integrated bottom toolbar.
//   • flat multiline editor (no inner border)
//   • bottom toolbar separated by a hairline — left controls + right controls
//   • send = up-arrow icon button, tinted-accent once there is input
// Enter submits; Shift+Enter inserts a newline.

export interface ZedComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** Left-aligned toolbar controls (add context, settings…). */
  leftSlot?: React.ReactNode;
  /** Controls left of the send button (model / mode / profile selectors). */
  rightSlot?: React.ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function ZedComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Message agent — @ to include context, / for commands",
  leftSlot,
  rightSlot,
  disabled = false,
  autoFocus = false,
  className,
}: ZedComposerProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  // Auto-grow up to a cap, then scroll.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-secondary px-2 pb-1.5 pt-2 focus-within:border-ring",
        className,
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="block max-h-40 w-full resize-none border-0 bg-transparent px-1 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      />

      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border pt-1.5">
        <div className="flex min-w-0 items-center gap-1">{leftSlot}</div>
        <div className="flex shrink-0 items-center gap-1">
          {rightSlot}
          <ZedIconButton
            icon={<ArrowUp />}
            size="sm"
            styleVariant={canSend ? "tinted" : "subtle"}
            disabled={!canSend}
            onClick={onSubmit}
            aria-label="Send"
          />
        </div>
      </div>
    </div>
  );
}
