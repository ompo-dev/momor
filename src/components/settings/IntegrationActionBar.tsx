import React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IntegrationTestStatus = "idle" | "testing" | "success" | "error";

export interface IntegrationActionBarProps {
  /** Ghost link — e.g. Obter chave */
  lead?: React.ReactNode;
  onTest?: () => void;
  testLabel?: string;
  testStatus?: IntegrationTestStatus;
  testDisabled?: boolean;
  onSecondaryTest?: () => void;
  secondaryTestLabel?: string;
  secondaryTestStatus?: IntegrationTestStatus;
  secondaryTestDisabled?: boolean;
  /** Primary save button slot */
  save?: React.ReactNode;
  /** Secondary actions — fetch models, set default, etc. */
  extra?: React.ReactNode;
  destructive?: React.ReactNode;
  className?: string;
}

export function IntegrationTestButton({
  label,
  status = "idle",
  onClick,
  disabled,
  variant = "outline",
}: {
  label: string;
  status?: IntegrationTestStatus;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "outline" | "secondary" | "ghost";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className="h-8 text-xs"
      onClick={onClick}
      disabled={disabled || status === "testing" || !onClick}
    >
      {status === "testing" ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : status === "success" ? (
        <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
      ) : status === "error" ? (
        <AlertCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />
      ) : null}
      {label}
    </Button>
  );
}

export function IntegrationActionBar({
  lead,
  onTest,
  testLabel,
  testStatus,
  testDisabled,
  onSecondaryTest,
  secondaryTestLabel,
  secondaryTestStatus,
  secondaryTestDisabled,
  save,
  extra,
  destructive,
  className,
}: IntegrationActionBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {lead}
        {onTest ? (
          <IntegrationTestButton
            label={testLabel ?? t("providers.testConnection")}
            status={testStatus}
            onClick={onTest}
            disabled={testDisabled}
          />
        ) : null}
        {onSecondaryTest ? (
          <IntegrationTestButton
            label={secondaryTestLabel ?? t("integrations.testTranscription")}
            status={secondaryTestStatus}
            onClick={onSecondaryTest}
            disabled={secondaryTestDisabled}
            variant="secondary"
          />
        ) : null}
        {extra}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:border-l sm:border-border/50 sm:pl-3">
        {save}
        {destructive}
      </div>
    </div>
  );
}
