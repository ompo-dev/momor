import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IntegrationCategory = "cloud" | "local" | "cli";

export interface IntegrationCardShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badges?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  feedback?: React.ReactNode;
  isDefault?: boolean;
  defaultExpanded?: boolean;
  category?: IntegrationCategory;
  className?: string;
  children: React.ReactNode;
}

const CATEGORY_ICON_RING: Record<IntegrationCategory, string> = {
  cloud: "ring-sky-500/20 bg-sky-500/5",
  local: "ring-violet-500/20 bg-violet-500/5",
  cli: "ring-amber-500/20 bg-amber-500/5",
};

export function IntegrationCardShell({
  title,
  subtitle,
  icon,
  badges,
  headerActions,
  footer,
  feedback,
  isDefault,
  defaultExpanded = true,
  category = "cloud",
  className,
  children,
}: IntegrationCardShellProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card
      className={cn(
        "group/card overflow-hidden border-border/80 bg-card/50 shadow-none transition-[box-shadow,border-color]",
        "hover:border-border hover:shadow-sm",
        isDefault && "border-primary/30 ring-1 ring-primary/25",
        className,
      )}
    >
      <div className="flex min-h-[4rem] items-center gap-3 px-4 py-3">
        {icon != null && (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
              CATEGORY_ICON_RING[category],
              typeof icon === "string" &&
                "text-sm font-semibold text-foreground",
            )}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {title}
            </p>
            {!expanded && badges ? (
              <div className="flex flex-wrap items-center gap-1">{badges}</div>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {expanded && badges ? (
            <div className="mr-1 hidden flex-wrap items-center gap-1 sm:flex">
              {badges}
            </div>
          ) : null}
          {headerActions ? (
            <div
              className="flex items-center gap-1 border-l border-border/50 pl-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="presentation"
            >
              {headerActions}
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
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
          <div className="space-y-5 border-t border-border/50 px-4 py-4">
            {children}
            {feedback}
          </div>
          {footer ? (
            <div className="border-t border-border/50 bg-muted/20 px-4 py-3">
              {footer}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
