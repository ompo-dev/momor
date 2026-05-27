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
    <section className={cn("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title ? (
            <h4 className="text-xs font-medium tracking-tight text-foreground">
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
  return <div className="h-px w-full bg-border/60" role="separator" />;
}
