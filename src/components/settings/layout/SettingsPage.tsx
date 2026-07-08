import * as React from "react";
import { cn } from "@/lib/utils";

interface SettingsPageProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsPage({
  title,
  description,
  actions,
  children,
  className,
}: SettingsPageProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1040px] space-y-4 pb-10", className)}>
      <div className="flex flex-col gap-3 border-b border-border-subtle/80 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
            Settings
          </p>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h2>
          {description && (
            <p className="max-w-3xl text-[12px] leading-5 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
