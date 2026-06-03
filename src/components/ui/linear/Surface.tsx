import * as React from "react";

import { cn } from "@/lib/utils";

export type LinearSurfaceLevel = 0 | 1 | 2 | 3 | 4;

const levelClass: Record<LinearSurfaceLevel, string> = {
  0: "bg-linear-canvas",
  1: "bg-linear-surface-1",
  2: "bg-linear-surface-2",
  3: "bg-linear-surface-3",
  4: "bg-linear-surface-4",
};

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: LinearSurfaceLevel;
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ level = 0, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        levelClass[level],
        "text-linear-ink",
        className,
      )}
      {...props}
    />
  ),
);
Surface.displayName = "Surface";

