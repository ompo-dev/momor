import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ToastProvider, ToastViewport } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const queryClient = new QueryClient()

interface AppProvidersProps {
  children: React.ReactNode
  /** Show legacy Radix toast viewport (kept for existing toast usages) */
  showToastViewport?: boolean
}

export function AppProviders({
  children,
  showToastViewport = true,
}: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          {children}
          {showToastViewport && <ToastViewport />}
          <Toaster position="bottom-right" richColors closeButton />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export { queryClient }
