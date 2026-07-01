import * as React from "react";
import { cn } from "@/lib/utils";

// Faithful port of Zed's IconButton (crates/ui/.../button/icon_button.rs).
// Square or wide shape, ButtonStyle::Subtle by default (transparent → ghost
// hover), compact sizing, tight rounding. Flat — no shadow.

type ZedIconButtonSize = "sm" | "md";
type ZedIconButtonStyle = "subtle" | "filled" | "tinted";

export interface ZedIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: ZedIconButtonSize;
  styleVariant?: ZedIconButtonStyle;
  selected?: boolean;
}

const sizeMap: Record<ZedIconButtonSize, string> = {
  sm: "h-6 w-6 [&_svg]:size-3.5",
  md: "h-7 w-7 [&_svg]:size-4",
};

const styleMap: Record<ZedIconButtonStyle, string> = {
  subtle:
    "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent",
  filled: "bg-secondary text-foreground hover:bg-accent border border-transparent",
  tinted:
    "bg-primary/15 text-primary hover:bg-primary/25 border border-primary/25",
};

export const ZedIconButton = React.forwardRef<
  HTMLButtonElement,
  ZedIconButtonProps
>(
  (
    { icon, size = "md", styleVariant = "subtle", selected, className, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        sizeMap[size],
        selected ? "bg-accent text-foreground" : styleMap[styleVariant],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  ),
);
ZedIconButton.displayName = "ZedIconButton";
