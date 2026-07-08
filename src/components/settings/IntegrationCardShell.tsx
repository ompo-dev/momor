import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IntegrationCategory = "cloud" | "local" | "cli";

export interface IntegrationCardShellProps {
  eyebrow?: string;
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
  cloud: "border-border-subtle/80 bg-background/45 text-text-secondary",
  local: "border-border-subtle/80 bg-background/45 text-text-secondary",
  cli: "border-border-subtle/80 bg-background/45 text-text-secondary",
};

export function IntegrationCardShell({
  eyebrow,
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
        "group/card overflow-hidden rounded-sm border-border-subtle/75 bg-background/10 text-card-foreground shadow-none transition-colors",
        "hover:border-border-muted/90",
        isDefault && "border-primary/24",
        className,
      )}
    >
      <div className="flex min-h-[3.5rem] items-start gap-3 px-3 py-2.5">
        {icon != null && (
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border",
              CATEGORY_ICON_RING[category],
              typeof icon === "string" &&
                "text-[11px] font-semibold text-foreground",
            )}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[12.5px] font-medium tracking-[-0.01em] text-foreground">
              {title}
            </p>
            {!expanded && badges ? (
              <div className="flex flex-wrap items-center gap-1">{badges}</div>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
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
              className="flex items-center gap-1 border-l border-border-subtle/70 pl-2"
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
            className="h-7 w-7 shrink-0 rounded-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
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
          <div className="space-y-4 border-t border-border-subtle/75 bg-transparent px-3 py-3">
            {children}
            {feedback}
          </div>
          {footer ? (
            <div className="border-t border-border-subtle/75 bg-transparent px-3 py-2.5">
              {footer}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
