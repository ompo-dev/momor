import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type StatusVariant =
  | "configured"
  | "notConfigured"
  | "enabled"
  | "default";

const VARIANT_CLASS: Record<StatusVariant, string> = {
  configured:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  notConfigured: "border-border/60 bg-muted/40 text-muted-foreground",
  enabled:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  default: "border-primary/30 bg-primary/10 text-primary",
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
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-medium leading-none",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {labels[variant]}
    </span>
  );
}
