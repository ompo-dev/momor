import React from "react"
import { useTranslation } from "react-i18next"
import {
  Monitor,
  Keyboard,
  Globe,
  HelpCircle,
  Plug,
  Smartphone,
  Info,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ZedListItem } from "@/components/zed/ZedListItem"
import { ZedIconButton } from "@/components/zed/ZedIconButton"
import { MomorLogoMark } from "@/components/MomorLogoMark"
import packageJson from "../../../package.json"

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
  icon: LucideIcon
  labelKey: string
  descriptionKey?: string
}

type NavGroup = {
  labelKey?: string
  items: NavItem[]
}

export const SETTINGS_TAB_META: Record<SettingsTabId, NavItem> = {
  general: {
    id: "general",
    icon: Monitor,
    labelKey: "settings.sidebar.general",
    descriptionKey: "settings.general.sectionDesc",
  },
  integrations: {
    id: "integrations",
    icon: Plug,
    labelKey: "settings.sidebar.integrations",
    descriptionKey: "providers.integrationsDesc",
  },
  keybinds: {
    id: "keybinds",
    icon: Keyboard,
    labelKey: "settings.sidebar.keybinds",
    descriptionKey: "settings.keybinds.desc",
  },
  "phone-mirror": {
    id: "phone-mirror",
    icon: Smartphone,
    labelKey: "settings.sidebar.phoneMirror",
  },
  language: {
    id: "language",
    icon: Globe,
    labelKey: "settings.sidebar.language",
    descriptionKey: "settings.language.description",
  },
  help: {
    id: "help",
    icon: HelpCircle,
    labelKey: "settings.sidebar.setupHelp",
  },
  about: {
    id: "about",
    icon: Info,
    labelKey: "settings.sidebar.about",
  },
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      SETTINGS_TAB_META.general,
    ],
  },
  {
    labelKey: "settings.sidebar.groupIntegrations",
    items: [
      SETTINGS_TAB_META.integrations,
    ],
  },
  {
    labelKey: "settings.sidebar.groupApp",
    items: [
      SETTINGS_TAB_META.keybinds,
      SETTINGS_TAB_META["phone-mirror"],
      SETTINGS_TAB_META.language,
    ],
  },
  {
    labelKey: "settings.sidebar.groupSupport",
    items: [
      SETTINGS_TAB_META.help,
      SETTINGS_TAB_META.about,
    ],
  },
]

export function SettingsNav({ activeTab, onTabChange, onClose }: SettingsNavProps) {
  const { t } = useTranslation()
  const activeItem = SETTINGS_TAB_META[activeTab as SettingsTabId]

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border-subtle/80 bg-bg-sidebar/98">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle/80 px-2.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border-subtle/80 bg-background/55 text-text-primary">
            <MomorLogoMark size={14} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              Settings
            </p>
            <p className="mt-0.5 truncate text-[11.5px] font-medium text-text-primary">
              {t(activeItem.labelKey)}
            </p>
          </div>
        </div>
        <ZedIconButton
          icon={<X className="h-4 w-4" />}
          size="sm"
          styleVariant="subtle"
          onClick={onClose}
          aria-label={t("settings.sidebar.close")}
          title={t("settings.sidebar.close")}
        />
      </div>

      <ScrollArea className="flex-1 px-2 py-2.5">
        <nav className="space-y-3">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-1">
              {group.labelKey ? (
                <p className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  {t(group.labelKey)}
                </p>
              ) : null}
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <ZedListItem
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    selected={activeTab === item.id}
                    startSlot={<Icon size={16} />}
                    spacing="dense"
                    className={cn(
                      activeTab === item.id
                        ? "border-border-subtle bg-bg-item-active/95 font-medium text-text-primary"
                        : "text-text-secondary",
                      "px-2 py-1.5 text-[12px]",
                    )}
                  >
                    {t(item.labelKey)}
                  </ZedListItem>
                )
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-border-subtle/80 px-2 py-2">
        <p className="mb-1.5 px-2 font-mono text-[10px] text-text-tertiary">
          v{packageJson.version}
        </p>
        <ZedListItem
          onClick={() => window.electronAPI.quitApp()}
          startSlot={<LogOut className="h-4 w-4" />}
          spacing="dense"
          className="px-2 py-1.5 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {t("settings.sidebar.quit")}
        </ZedListItem>
      </div>
    </aside>
  )
}
