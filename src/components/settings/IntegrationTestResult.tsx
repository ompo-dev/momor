import React, { useEffect } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IntegrationTestResultProps {
  status: "idle" | "success" | "error";
  message?: string;
  onDismiss?: () => void;
  autoDismissMs?: number;
  className?: string;
}

export function IntegrationTestResult({
  status,
  message,
  onDismiss,
  autoDismissMs = 4000,
  className,
}: IntegrationTestResultProps) {
  useEffect(() => {
    if (status === "success" && onDismiss && autoDismissMs > 0) {
      const t = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(t);
    }
  }, [status, onDismiss, autoDismissMs]);

  if (status === "idle" || !message) return null;

  const isError = status === "error";

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-[11px] leading-snug",
        isError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
        className,
      )}
      role="status"
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 break-words">{message}</span>
    </p>
  );
}
