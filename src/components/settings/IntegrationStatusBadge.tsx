import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant =
  | "configured"
  | "notConfigured"
  | "enabled"
  | "default";

const VARIANT_CLASS: Record<StatusVariant, string> = {
  configured: "text-emerald-600 dark:text-emerald-400",
  notConfigured: "",
  enabled: "text-emerald-600 dark:text-emerald-400",
  default: "",
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
    <Badge
      variant={variant === "default" ? "default" : "secondary"}
      className={cn(
        "h-5 shrink-0 px-1.5 text-[10px] font-medium",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {labels[variant]}
    </Badge>
  );
}
