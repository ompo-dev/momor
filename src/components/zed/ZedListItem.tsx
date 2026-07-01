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
  extraDense: "py-0.5",
  dense: "py-1",
  sparse: "py-1.5",
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
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "group flex w-full items-center gap-2 px-2 text-sm",
        spacingMap[spacing],
        rounded && "rounded-md",
        disabled
          ? "pointer-events-none opacity-50"
          : onClick && "cursor-pointer",
        selected
          ? "bg-bg-item-active text-foreground"
          : !disabled && onClick && "hover:bg-accent",
        className,
      )}
      {...props}
    >
      {startSlot ? (
        <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4">
          {startSlot}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {endSlot ? <span className="flex shrink-0 items-center">{endSlot}</span> : null}
    </div>
  );
}
