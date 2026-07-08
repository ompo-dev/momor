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
  /** Optional slim rail above the editor (thread state / quick actions). */
  topSlot?: React.ReactNode;
  /** Left-aligned toolbar controls (add context, settings…). */
  leftSlot?: React.ReactNode;
  /** Controls left of the send button (model / mode / profile selectors). */
  rightSlot?: React.ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
}

export function ZedComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Message agent — @ to include context, / for commands",
  topSlot,
  leftSlot,
  rightSlot,
  disabled = false,
  autoFocus = false,
  className,
  textareaRef,
  onKeyDown,
  onMouseDown,
}: ZedComposerProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  const handleRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      ref.current = node;
      if (!textareaRef) return;
      if (typeof textareaRef === "function") {
        textareaRef(node);
        return;
      }
      textareaRef.current = node;
    },
    [textareaRef],
  );

  // Auto-grow up to a cap, then scroll.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <div
      className={cn(
        "rounded-sm border border-border-subtle/80 bg-background/82 px-2 pb-1.5 pt-2 shadow-[0_14px_30px_-26px_rgba(0,0,0,0.85)] focus-within:border-ring/80",
        className,
      )}
    >
      {topSlot ? (
        <div className="mb-1.5 border-b border-border-subtle/80 px-1 pb-1.5">
          {topSlot}
        </div>
      ) : null}

      <textarea
        ref={handleRef}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onMouseDown={onMouseDown}
        className="block max-h-40 w-full resize-none border-0 bg-transparent px-1 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      />

      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border-subtle/80 pt-1.5">
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
