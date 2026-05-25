import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ModalShellProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Use framer-motion shell instead of Dialog (for complex panels) */
  useMotionShell?: boolean
}

/**
 * Unified modal shell — shadcn Dialog by default, motion overlay for large panels.
 */
export function ModalShell({
  isOpen,
  onClose,
  children,
  className,
  useMotionShell = true,
}: ModalShellProps) {
  if (!useMotionShell) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className={cn(
            "max-w-4xl h-[80vh] p-0 gap-0 overflow-hidden border-border bg-card",
            className,
          )}
        >
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className={cn(
              "w-full max-w-4xl h-[80vh] rounded-xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
