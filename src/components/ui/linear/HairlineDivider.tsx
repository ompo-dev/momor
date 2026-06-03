import * as React from "react";

import { cn } from "@/lib/utils";

export interface HairlineDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  strength?: "default" | "strong" | "tertiary";
}

export const HairlineDivider = React.forwardRef<HTMLDivElement, HairlineDividerProps>(
  ({ strength = "default", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "h-px w-full",
        strength === "strong"
          ? "bg-linear-hairline-strong"
          : strength === "tertiary"
            ? "bg-linear-hairline-tertiary"
            : "bg-linear-hairline",
        className,
      )}
      {...props}
    />
  ),
);
HairlineDivider.displayName = "HairlineDivider";

