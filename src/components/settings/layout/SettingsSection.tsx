import * as React from "react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title?: string;
  description?: string;
  /** Primary action aligned with section title (e.g. Add integration) */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  action,
  children,
  className,
}: SettingsSectionProps) {
  const hasHeader = title || description || action;

  return (
    <section className={cn("space-y-4", className)}>
      {hasHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            {title ? (
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
