import * as React from "react";
import { Info, Check, TriangleAlert, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";

// Faithful port of Zed's `ui::Callout` (crates/ui/src/components/callout.rs).
//
// Zed anatomy: h_flex · p_2 (8px) · gap_2 (8px) · items_start · top/bottom border
//   · bg = status background at low opacity (per severity)
//   · icon sized to the title line-height, colored by severity
//   · v_flex body: title row (Label Small, flex_1) + actions slot (gap_0p5,
//     justify_between, flex_wrap) then a muted description (text_ui_sm,
//     max_h_32, scrollable).
//
// Used for situations where the user needs information and likely a decision —
// e.g. the screen-recording permission warning in the meeting overlay.

export type CalloutSeverity = "info" | "success" | "warning" | "error";

type SeverityStyle = {
  Icon: React.ComponentType<{ size?: number | string; className?: string }>;
  iconColor: string;
  bg: string;
};

const severityStyles: Record<CalloutSeverity, SeverityStyle> = {
  info: { Icon: Info, iconColor: "text-muted-foreground", bg: "bg-primary/10" },
  success: { Icon: Check, iconColor: "text-[#a1c181]", bg: "bg-[#a1c181]/10" },
  warning: {
    Icon: TriangleAlert,
    iconColor: "text-[#dec184]",
    bg: "bg-[#dec184]/15",
  },
  error: { Icon: CircleX, iconColor: "text-destructive", bg: "bg-destructive/10" },
};

export interface CalloutProps {
  severity?: CalloutSeverity;
  /** Override the default severity icon. */
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action(s), rendered top-right of the title row. */
  actions?: React.ReactNode;
  /** Optional dismiss control (usually an icon button), far right. */
  dismiss?: React.ReactNode;
  borderPosition?: "top" | "bottom" | "none";
  className?: string;
}

export function Callout({
  severity = "info",
  icon,
  title,
  description,
  actions,
  dismiss,
  borderPosition = "top",
  className,
}: CalloutProps) {
  const style = severityStyles[severity];
  const SeverityIcon = style.Icon;
  const hasActions = Boolean(actions) || Boolean(dismiss);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-start gap-2 overflow-x-hidden p-2 border-border",
        borderPosition === "top" && "border-t",
        borderPosition === "bottom" && "border-b",
        style.bg,
        className,
      )}
    >
      <div
        className={cn(
          "flex h-5 shrink-0 items-center justify-center",
          style.iconColor,
        )}
      >
        {icon ?? <SeverityIcon size={16} />}
      </div>
      <div className="flex w-full min-w-0 flex-col gap-1">
        <div className="flex min-h-5 w-full flex-wrap items-center justify-between gap-1">
          {title ? (
            <div className="min-w-0 flex-1 text-sm font-medium text-foreground">
              {title}
            </div>
          ) : null}
          {hasActions ? (
            <div className="flex shrink-0 items-center gap-1">
              {actions}
              {dismiss}
            </div>
          ) : null}
        </div>
        {description ? (
          <div className="max-h-32 w-full overflow-y-auto text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
}
