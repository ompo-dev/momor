import * as React from "react";
import { cn } from "@/lib/utils";

// Faithful port of Zed's ListItem (crates/ui/.../list/list_item.rs).
// Dense selectable row: start slot (icon/avatar), children (label), end slot
// (button/disclosure). Ghost hover, element-selected when selected, tight
// rounding, no shadow.

type ZedListItemSpacing = "extraDense" | "dense" | "sparse";

export interface ZedListItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  startSlot?: React.ReactNode;
  endSlot?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  spacing?: ZedListItemSpacing;
  /** Show rounded corners + selectable hover (Zed `.rounded()` + selectable). */
  rounded?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const spacingMap: Record<ZedListItemSpacing, string> = {
  extraDense: "min-h-6 py-px",
  dense: "min-h-7 py-0.5",
  sparse: "min-h-8 py-1",
};

export function ZedListItem({
  startSlot,
  endSlot,
  selected = false,
  disabled = false,
  spacing = "dense",
  rounded = true,
  onClick,
  className,
  children,
  ...props
}: ZedListItemProps) {
  const textLikeChild =
    typeof children === "string" || typeof children === "number";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onClick={disabled ? undefined : onClick}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "group flex w-full items-center gap-2 border px-1.5 text-[13px] leading-tight transition-colors",
        spacingMap[spacing],
        rounded && "rounded-sm",
        disabled
          ? "pointer-events-none opacity-50"
          : onClick && "cursor-pointer",
        selected
          ? "border-border-muted bg-bg-item-active text-text-primary"
          : "border-transparent text-text-secondary",
        !disabled &&
          onClick &&
          !selected &&
          "hover:bg-accent/60 hover:text-text-primary active:bg-bg-item-active/80",
        !disabled &&
          onClick &&
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    >
      {startSlot ? (
        <div
          className={cn(
            "flex shrink-0 items-center [&_svg]:size-3.5",
            selected ? "text-text-primary" : "text-text-secondary",
          )}
        >
          {startSlot}
        </div>
      ) : null}
      <div className={cn("min-w-0 flex-1", textLikeChild && "truncate")}>
        {children}
      </div>
      {endSlot ? <div className="flex shrink-0 items-center">{endSlot}</div> : null}
    </div>
  );
}
