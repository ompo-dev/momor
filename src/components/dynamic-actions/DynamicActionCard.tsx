import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, X, Zap } from "lucide-react";
import type { DynamicActionPayload } from "@/types/electron";

interface Props {
  action: DynamicActionPayload;
  isPrimary: boolean;
  onAccept: (action: DynamicActionPayload) => void;
  onDismiss: (actionId: string) => void;
}

// Single dynamic action card. Compact, flat, dismissible.
export const DynamicActionCard: React.FC<Props> = ({
  action,
  isPrimary,
  onAccept,
  onDismiss,
}) => {
  const [busy, setBusy] = useState(false);
  const evidence = action.evidenceRefs?.[0];
  const evidenceText = evidence?.text?.trim() ?? "";
  const evidenceSnippet =
    evidenceText.length > 90
      ? `${evidenceText.slice(0, 90).trimEnd()}...`
      : evidenceText;

  const confidencePct = Math.round((action.confidence ?? 0) * 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className={[
        "group relative flex items-stretch gap-2 rounded-md border px-2.5 py-2",
        "no-drag select-none transition-colors duration-150 cursor-pointer",
        isPrimary
          ? "border-primary/35 bg-primary/[0.08] hover:bg-primary/[0.12]"
          : "border-border-subtle/80 bg-background/45 hover:bg-background/60",
      ].join(" ")}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await onAccept(action);
        } finally {
          setBusy(false);
        }
      }}
      title={action.description ?? action.label}
      data-testid={`dynamic-action-card-${action.id}`}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border-subtle/80 bg-background/55">
        <Zap className={`h-3.5 w-3.5 ${isPrimary ? "text-primary" : "text-text-tertiary"}`} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[12px] font-semibold overlay-text-primary">
            {action.label}
          </span>
          {confidencePct > 0 && (
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-tertiary">
              {confidencePct}%
            </span>
          )}
        </div>
        {evidenceSnippet && (
          <span className="truncate text-[10.5px] text-text-tertiary">
            "{evidenceSnippet}"
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isPrimary && (
          <kbd className="hidden sm:inline-flex items-center rounded-sm border border-border-subtle/80 bg-background/58 px-1.5 py-0.5 text-[9px] font-medium text-text-tertiary">
            Tab
          </kbd>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary transition-colors group-hover:text-text-primary" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(action.id);
          }}
          className="ml-0.5 rounded-sm p-1 text-text-tertiary transition-colors opacity-0 group-hover:opacity-100 hover:bg-background/65 hover:text-text-primary"
          title="Dismiss"
          aria-label={`Dismiss ${action.label}`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
};
