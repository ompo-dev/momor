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
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border-subtle/80 bg-background/30 text-text-tertiary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <p className="text-[12.5px] font-medium leading-5 text-foreground">
            {title}
          </p>
          {description ? (
            <div className="text-[11px] leading-5 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
