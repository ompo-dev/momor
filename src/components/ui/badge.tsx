import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Zed badge ≈ Chip / tinted label: tight rounded-sm, 1px border, flat, no shadow.
const badgeVariants = cva(
  "inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/15 text-primary",
        secondary:
          "border-border-muted bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
