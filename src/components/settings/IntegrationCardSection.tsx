import React from "react";
import { cn } from "@/lib/utils";

export interface IntegrationCardSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function IntegrationCardSection({
  title,
  description,
  children,
  className,
}: IntegrationCardSectionProps) {
  return (
    <section className={cn("space-y-2", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title ? (
            <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {title}
            </h4>
          ) : null}
          {description ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function IntegrationCardDivider() {
  return <div className="h-px w-full bg-border-subtle/70" role="separator" />;
}
