import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { DynamicActionCard } from "./DynamicActionCard";
import type { DynamicActionPayload } from "@/types/electron";

interface Props {
  // Called when the user accepts (or hits Tab on the primary). Parent should
  // kick off the live answer stream using action.promptInstruction.
  onAcceptAction: (action: DynamicActionPayload) => void;
  // Optional: max actions to keep visible.
  maxVisible?: number;
  // Optional: how long actions stay visible without user interaction (ms).
  // Server side already expires; this is the renderer-side cap.
  staleAfterMs?: number;
}

// DynamicActionBar - compact live action row aligned to the composer width.
export const DynamicActionBar: React.FC<Props> = ({
  onAcceptAction,
  maxVisible = 3,
  staleAfterMs = 60_000,
}) => {
  const [actions, setActions] = useState<DynamicActionPayload[]>([]);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const handleIncoming = useCallback(
    (action: DynamicActionPayload) => {
      setActions((prev) => {
        if (prev.some((a) => a.id === action.id)) return prev;
        const next = [...prev, action]
          .filter((a) => Date.now() - a.createdAt < staleAfterMs)
          .sort(
            (a, b) => b.priority - a.priority || b.createdAt - a.createdAt,
          );
        return next.slice(0, maxVisible * 2);
      });
    },
    [staleAfterMs, maxVisible],
  );

  const dismiss = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
    window.electronAPI?.dismissDynamicAction?.(id).catch(() => {});
  }, []);

  const accept = useCallback(
    async (action: DynamicActionPayload) => {
      setActions((prev) => prev.filter((a) => a.id !== action.id));
      try {
        await window.electronAPI?.acceptDynamicAction?.(action.id);
      } catch {}
      onAcceptAction(action);
    },
    [onAcceptAction],
  );

  useEffect(() => {
    const off = window.electronAPI?.onIntelligenceDynamicAction?.((data) => {
      if (data?.action) handleIncoming(data.action);
    });
    return () => {
      try {
        off?.();
      } catch {}
    };
  }, [handleIncoming]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      const visible = actionsRef.current.slice(0, maxVisible);
      if (visible.length === 0) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      void accept(visible[0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accept, maxVisible]);

  useEffect(() => {
    const t = setInterval(() => {
      setActions((prev) =>
        prev.filter((a) => Date.now() - a.createdAt < staleAfterMs),
      );
    }, 5_000);
    return () => clearInterval(t);
  }, [staleAfterMs]);

  const visible = useMemo(() => actions.slice(0, maxVisible), [actions, maxVisible]);

  if (visible.length === 0) return null;

  return (
    <div
      className="mx-auto flex w-full max-w-[640px] flex-col gap-1.5 px-4 pb-1 pt-1"
      data-testid="dynamic-action-bar"
      aria-label="Suggested actions"
    >
      <AnimatePresence initial={false}>
        {visible.map((a, i) => (
          <DynamicActionCard
            key={a.id}
            action={a}
            isPrimary={i === 0}
            onAccept={accept}
            onDismiss={dismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
