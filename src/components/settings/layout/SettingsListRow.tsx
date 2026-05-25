import * as React from "react";
import { cn } from "@/lib/utils";

interface SettingsListRowProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
}

export function SettingsListRow({
  icon,
  title,
  description,
  control,
  className,
}: SettingsListRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-none text-foreground">
            {title}
          </p>
          {description ? (
            <div className="text-xs text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
