import * as React from "react";
import { cn } from "../../lib/utils";

type StatusTone = "neutral" | "accent" | "positive";

interface WorkspaceDocumentLayoutProps {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  contentClassName?: string;
}

const STATUS_TONE_STYLES: Record<StatusTone, string> = {
  neutral: "border-border-subtle text-text-tertiary",
  accent: "border-sky-500/20 text-sky-500 dark:text-sky-400",
  positive: "border-emerald-500/25 text-emerald-500 dark:text-emerald-400",
};

export function WorkspaceDocumentLayout({
  eyebrow,
  title,
  description,
  status,
  actions,
  toolbar,
  sidebar,
  children,
  className,
  bodyClassName,
  contentClassName,
}: WorkspaceDocumentLayoutProps) {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background custom-scrollbar",
        className,
      )}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col">
        <div className="border-b border-border-subtle/75 bg-background/92 px-5 py-3.5 backdrop-blur-sm sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                {eyebrow}
              </p>
              <div className="mt-3 min-w-0">{title}</div>
              {(description || status) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {description ? (
                    <p className="text-[11px] leading-5 text-text-tertiary">
                      {description}
                    </p>
                  ) : null}
                  {status}
                </div>
              )}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </div>

        {toolbar ? (
          <div className="border-b border-border-subtle/75 bg-background/12 px-5 sm:px-6">
            {toolbar}
          </div>
        ) : null}

        <div
          className={cn(
            "grid flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_252px]",
            bodyClassName,
          )}
        >
          <div
            className={cn(
              "min-w-0 px-5 py-5 sm:px-6 sm:py-6",
              contentClassName,
            )}
          >
            {children}
          </div>
          {sidebar ? (
            <aside className="border-t border-border-subtle/75 bg-transparent px-4 py-5 lg:border-l lg:border-t-0">
              <div className="space-y-4 lg:sticky lg:top-4">{sidebar}</div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function WorkspaceStatusChip({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em]",
        STATUS_TONE_STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function WorkspaceFieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function WorkspaceInspectorCard({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-l border-border-subtle/80 pl-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-[11.5px] leading-5 text-text-secondary">
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}
