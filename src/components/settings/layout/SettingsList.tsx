import * as React from "react";
import { cn } from "@/lib/utils";

export function SettingsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm border border-border-subtle/80 bg-background/14 divide-y divide-border-subtle/80",
        className,
      )}
    >
      {children}
    </div>
  );
}
