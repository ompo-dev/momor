import * as React from "react";
import { cn } from "@/lib/utils";

// Faithful port of Zed's KeyBinding / keybinding_hint (crates/ui/.../keybinding*).
// Renders keystrokes as small flat kbd chips: element-background fill, hairline
// border, muted text, tight rounding. No shadow.

export interface ZedKeyBindingProps {
  /** e.g. ["⌘", "⇧", "H"] or ["Ctrl", "K"]. */
  keys: string[];
  className?: string;
}

export function ZedKeyBinding({ keys, className }: ZedKeyBindingProps) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <kbd
          key={`${key}-${i}`}
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border-muted bg-secondary px-1 text-[10px] font-medium leading-none text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
