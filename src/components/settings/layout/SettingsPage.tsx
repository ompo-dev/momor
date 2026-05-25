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
    <div className={cn("mx-auto w-full max-w-2xl space-y-6 pb-8", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
