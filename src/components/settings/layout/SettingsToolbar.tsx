import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Shared control height for settings rows (select, input, button). */
export const SETTINGS_CONTROL_CLASS = "h-9";

interface SettingsToolbarProps {
  label?: string;
  /** Primary control (select, input group) */
  children: React.ReactNode;
  /** Trailing action (e.g. Add button) — aligned to control baseline */
  trailing?: React.ReactNode;
  className?: string;
}

export function SettingsToolbar({
  label,
  children,
  trailing,
  className,
}: SettingsToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 w-full flex-col gap-1.5 sm:max-w-md">
        {label ? (
          <Label className="text-xs font-medium text-muted-foreground">
            {label}
          </Label>
        ) : null}
        {children}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center sm:pb-0">{trailing}</div>
      ) : null}
    </div>
  );
}
