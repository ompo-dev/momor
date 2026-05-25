import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

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
    <Card
      className={cn(
        "border-border",
        highlighted && "shadow-md shadow-primary/10",
        className,
      )}
    >
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon}
            <Label className="text-base font-semibold leading-none">{title}</Label>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-label={title}
        />
      </CardContent>
    </Card>
  )
}
