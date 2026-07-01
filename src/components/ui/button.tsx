import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Faithful port of Zed's button system (crates/ui button_like.rs). Zed buttons
// are flat, compact and tight-cornered — no drop shadows. Zed's *emphasis*
// button is a translucent "Tinted Accent" (NOT a solid fill); the default is
// "Subtle" (transparent → faint ghost hover); "Outlined" carries a border_variant.
// All variants keep a 1px border (transparent where Zed has none) so every
// button shares the same box metrics.
//   default     → Zed Tinted(Accent)   — the emphasized action
//   filled      → Zed Filled           — neutral element fill
//   outline     → Zed Outlined         — element bg + border_variant
//   secondary   → Zed Subtle on element
//   ghost       → Zed Subtle           — transparent, ghost hover
//   destructive → Zed Tinted(Error)
//   tinted      → Zed Tinted(Accent)   — explicit alias of default
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/25 bg-primary/15 text-primary hover:bg-primary/25 active:bg-primary/30",
        filled:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-accent active:bg-bg-item-active",
        destructive:
          "border border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25 active:bg-destructive/30",
        outline:
          "border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground hover:border-border-muted",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        tinted:
          "border border-primary/25 bg-primary/15 text-primary hover:bg-primary/25 active:bg-primary/30",
        ghost:
          "border border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
