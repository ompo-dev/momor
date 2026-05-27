import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface IntegrationFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function IntegrationField({
  label,
  hint,
  children,
  className,
}: IntegrationFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-medium text-foreground">{label}</Label>
        {hint ? (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
