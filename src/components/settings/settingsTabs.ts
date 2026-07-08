import type { SettingsTabId } from "../shell/SettingsNav";

const REMOVED_TABS = new Set(["momor-api", "momor-pro", "calendar"]);

const TAB_ALIASES: Record<string, SettingsTabId> = {
  api: "integrations",
  "ai-providers": "integrations",
  audio: "integrations",
};

export function normalizeSettingsTab(tab?: string): SettingsTabId {
  if (!tab || REMOVED_TABS.has(tab)) return "general";
  const mapped = TAB_ALIASES[tab] ?? tab;
  const valid: SettingsTabId[] = [
    "general",
    "integrations",
    "keybinds",
    "phone-mirror",
    "language",
    "help",
    "about",
  ];
  return valid.includes(mapped as SettingsTabId)
    ? (mapped as SettingsTabId)
    : "general";
}
