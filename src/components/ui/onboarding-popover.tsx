import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export interface OnboardingPopoverProps {
  open: boolean
  icon: React.ReactNode
  title: string
  badge?: string
  description: string
  dismissLabel: string
  actionLabel: string
  onDismiss: () => void
  onAction: () => void
  className?: string
}

export function OnboardingPopover({
  open,
  icon,
  title,
  badge,
  description,
  dismissLabel,
  actionLabel,
  onDismiss,
  onAction,
  className,
}: OnboardingPopoverProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -2, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className={cn(
            "absolute top-[38px] right-2 w-[270px] z-[300] origin-top-right",
            className,
          )}
        >
          <div className="absolute -top-[5px] right-[14px] w-2.5 h-2.5 rotate-45 rounded-tl-sm bg-card border-t border-l border-border" />
          <Card className="border-border bg-card/95 backdrop-blur-xl shadow-xl">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full bg-primary/10 text-primary">
                  {icon}
                </div>
                <div className="flex-1 pt-0.5 min-w-0">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 flex-wrap">
                    <span>{title}</span>
                    {badge && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {badge}
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3.5">
                    {description}
                  </p>
                  <div className="flex justify-end gap-1.5">
                    <Button variant="ghost" size="sm" onClick={onDismiss}>
                      {dismissLabel}
                    </Button>
                    <Button size="sm" onClick={onAction}>
                      {actionLabel}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
