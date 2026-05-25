import React from "react"
import { useTranslation } from "react-i18next"
import {
  Monitor,
  Mic,
  Keyboard,
  Globe,
  HelpCircle,
  FlaskConical,
  Smartphone,
  Info,
  LogOut,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export type SettingsTabId =
  | "general"
  | "integrations"
  | "keybinds"
  | "phone-mirror"
  | "language"
  | "help"
  | "about"

interface SettingsNavProps {
  activeTab: string
  onTabChange: (tab: SettingsTabId) => void
  onClose: () => void
}

type NavItem = {
  id: SettingsTabId
  icon: React.ReactNode
  labelKey: string
}

type NavGroup = {
  labelKey?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: "general", icon: <Monitor size={16} />, labelKey: "settings.sidebar.general" },
    ],
  },
  {
    labelKey: "settings.sidebar.groupIntegrations",
    items: [
      { id: "integrations", icon: <FlaskConical size={16} />, labelKey: "settings.sidebar.integrations" },
    ],
  },
  {
    labelKey: "settings.sidebar.groupApp",
    items: [
      { id: "keybinds", icon: <Keyboard size={16} />, labelKey: "settings.sidebar.keybinds" },
      { id: "phone-mirror", icon: <Smartphone size={16} />, labelKey: "settings.sidebar.phoneMirror" },
      { id: "language", icon: <Globe size={16} />, labelKey: "settings.sidebar.language" },
    ],
  },
  {
    labelKey: "settings.sidebar.groupSupport",
    items: [
      { id: "help", icon: <HelpCircle size={16} />, labelKey: "settings.sidebar.setupHelp" },
      { id: "about", icon: <Info size={16} />, labelKey: "settings.sidebar.about" },
    ],
  },
]

export function SettingsNav({ activeTab, onTabChange, onClose }: SettingsNavProps) {
  const { t } = useTranslation()

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="border-b border-border px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("settings.title")}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">Momor</p>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-4">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-1">
              {group.labelKey ? (
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {t(group.labelKey)}
                </p>
              ) : null}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    activeTab === item.id
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {item.icon}
                  <span className="truncate">{t(item.labelKey)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="space-y-1 border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => window.electronAPI.quitApp()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("settings.sidebar.quit")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={onClose}
        >
          <X className="mr-2 h-4 w-4" />
          {t("settings.sidebar.close")}
        </Button>
      </div>
    </aside>
  )
}
