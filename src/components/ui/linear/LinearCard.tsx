import * as React from "react";

import { cn } from "@/lib/utils";

export interface LinearCardProps extends React.HTMLAttributes<HTMLDivElement> {
  surface?: 1 | 2;
}

export const LinearCard = React.forwardRef<HTMLDivElement, LinearCardProps>(
  ({ surface = 1, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        surface === 2 ? "bg-linear-surface-2" : "bg-linear-surface-1",
        "rounded-linear-lg border border-linear-hairline text-linear-ink",
        className,
      )}
      {...props}
    />
  ),
);
LinearCard.displayName = "LinearCard";

export const LinearCardHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-6 pt-6", className)} {...props} />
);

export const LinearCardTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn(
      "text-[15px] font-medium tracking-[-0.02em] text-linear-ink",
      className,
    )}
    {...props}
  />
);

export const LinearCardDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("mt-1 text-sm text-linear-ink-muted", className)} {...props} />
);

export const LinearCardContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-6 pb-6", className)} {...props} />
);

