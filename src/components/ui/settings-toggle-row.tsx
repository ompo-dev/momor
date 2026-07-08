import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"

export interface SettingsToggleRowProps {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  highlighted?: boolean
}

export function SettingsToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
  highlighted,
}: SettingsToggleRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-sm border border-border-subtle/80 bg-background/14 px-4 py-3.5",
        highlighted && "border-primary/35 bg-primary/[0.05]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border-subtle/80 bg-background/30 text-text-tertiary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <p className="text-[12.5px] font-medium leading-5 text-foreground">
            {title}
          </p>
          {description ? (
            <div className="text-[11px] leading-5 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
      />
    </div>
  )
}
