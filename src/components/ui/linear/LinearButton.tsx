import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const linearButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-[13px] font-medium tracking-[0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-primary/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Zed emphasis = translucent Tinted(Accent), not a solid fill.
        primary:
          "bg-linear-primary/15 text-linear-primary border border-linear-primary/25 hover:bg-linear-primary/25",
        secondary:
          "bg-linear-surface-1 text-linear-ink border border-linear-hairline hover:bg-linear-surface-2 hover:border-linear-hairline-strong",
        ghost:
          "bg-transparent text-linear-ink-muted hover:text-linear-ink hover:bg-linear-surface-2/60",
      },
      size: {
        sm: "h-8 px-3 py-1.5",
        md: "h-9",
        lg: "h-10 px-4",
        icon: "h-9 w-9 px-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface LinearButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof linearButtonVariants> {
  asChild?: boolean;
}

export const LinearButton = React.forwardRef<HTMLButtonElement, LinearButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(linearButtonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
LinearButton.displayName = "LinearButton";

export { linearButtonVariants };

