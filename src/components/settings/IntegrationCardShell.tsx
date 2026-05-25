import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface IntegrationCardShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badges?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  isDefault?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function IntegrationCardShell({
  title,
  subtitle,
  icon,
  badges,
  headerActions,
  footer,
  isDefault,
  defaultExpanded = true,
  className,
  children,
}: IntegrationCardShellProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow",
        isDefault && "ring-1 ring-primary/40",
        className,
      )}
    >
      <div className="flex min-h-[3.25rem] items-center gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
        {icon != null && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background",
              typeof icon === "string" &&
                "text-xs font-semibold text-foreground",
            )}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {badges}
          {headerActions ? (
            <div className="flex items-center gap-1 border-l border-border/50 pl-1.5 ml-0.5">
              {headerActions}
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? t("common.collapse") : t("common.expand")}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="space-y-4 p-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/50 bg-muted/10 px-4 py-3">
              {footer}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
