import * as React from "react";
import { cn } from "@/lib/utils";

// Faithful port of Zed's `ui::Chip` (crates/ui/src/components/chip.rs).
//
// Zed anatomy: h_flex · gap_0p5 (2px) · px_1 (4px) · border_1 · rounded_sm
//   · bg = element_background · border = border · XSmall label (10px).
// Chips are containers for an informative label, optionally icon-prefixed.

export type ChipColor =
  | "default"
  | "accent"
  | "muted"
  | "success"
  | "warning"
  | "error";

const labelColor: Record<ChipColor, string> = {
  default: "text-foreground",
  accent: "text-primary",
  muted: "text-muted-foreground",
  success: "text-[#a1c181]",
  warning: "text-[#dec184]",
  error: "text-destructive",
};

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Icon node (e.g. a lucide icon) rendered before the label. */
  icon?: React.ReactNode;
  /** Semantic label color, mirroring Zed's Color enum. */
  color?: ChipColor;
  /** Allow the chip to shrink and truncate its label. */
  truncate?: boolean;
}

export function Chip({
  className,
  icon,
  color = "default",
  truncate = false,
  children,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[3px] border border-border-muted bg-secondary px-1 py-px text-[10px] font-medium leading-tight",
        truncate ? "min-w-0" : "flex-none",
        labelColor[color],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="shrink-0 [&_svg]:size-3 [&_svg]:shrink-0">{icon}</span>
      ) : null}
      <span className={cn(truncate && "truncate")}>{children}</span>
    </span>
  );
}
