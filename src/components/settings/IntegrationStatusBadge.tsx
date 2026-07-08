import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type StatusVariant =
  | "configured"
  | "notConfigured"
  | "enabled"
  | "default";

const VARIANT_CLASS: Record<StatusVariant, string> = {
  configured:
    "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400",
  notConfigured:
    "border-border-subtle/80 bg-background/38 text-muted-foreground",
  enabled:
    "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400",
  default:
    "border-primary/25 bg-primary/[0.08] text-primary",
};

interface IntegrationStatusBadgeProps {
  variant: StatusVariant;
  className?: string;
}

export function IntegrationStatusBadge({
  variant,
  className,
}: IntegrationStatusBadgeProps) {
  const { t } = useTranslation();
  const labels: Record<StatusVariant, string> = {
    configured: t("common.configured"),
    notConfigured: t("common.notConfigured"),
    enabled: t("common.enabled"),
    default: t("settings.audio.sttDefault"),
  };

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] leading-none",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {labels[variant]}
    </span>
  );
}
