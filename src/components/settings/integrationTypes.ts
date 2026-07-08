export type CloudProviderId = "gemini" | "groq" | "openai" | "claude" | "deepseek";
export type LocalProviderId = "codex-cli" | "openclaude" | "ollama" | "custom";
export type IntegrationId = CloudProviderId | LocalProviderId;

export const PINNED_INTEGRATIONS_KEY = "momor_pinned_integrations";

export const INTEGRATION_META: Record<
  IntegrationId,
  {
    label: string;
    category: "cloud" | "local";
    hidden?: boolean;
    descriptionKey?: string;
  }
> = {
  gemini: {
    label: "Gemini",
    category: "cloud",
    descriptionKey: "providers.cloudProviderDesc",
  },
  groq: {
    label: "Groq",
    category: "cloud",
    descriptionKey: "providers.cloudProviderDesc",
  },
  openai: {
    label: "OpenAI",
    category: "cloud",
    descriptionKey: "providers.cloudProviderDesc",
  },
  claude: {
    label: "Claude",
    category: "cloud",
    descriptionKey: "providers.cloudProviderDesc",
  },
  deepseek: {
    label: "DeepSeek",
    category: "cloud",
    descriptionKey: "providers.deepseekProviderDesc",
  },
  "codex-cli": {
    label: "Codex",
    category: "local",
    descriptionKey: "providers.codexCliOAuthDesc",
  },
  openclaude: {
    label: "Claude Code",
    category: "local",
    descriptionKey: "providers.openClaudeDesc",
    hidden: true,
  },
  ollama: {
    label: "Ollama",
    category: "local",
    descriptionKey: "providers.ollamaDesc",
  },
  custom: {
    label: "Custom endpoint",
    category: "local",
    descriptionKey: "providers.customProvidersDesc",
  },
};

export function readPinnedIntegrations(): IntegrationId[] {
  try {
    const raw = localStorage.getItem(PINNED_INTEGRATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IntegrationId[];
    return parsed.filter(
      (id) => id in INTEGRATION_META && !INTEGRATION_META[id].hidden,
    );
  } catch {
    return [];
  }
}

export function writePinnedIntegrations(ids: IntegrationId[]) {
  const visibleOnly = ids.filter((id) => !INTEGRATION_META[id].hidden);
  localStorage.setItem(PINNED_INTEGRATIONS_KEY, JSON.stringify(visibleOnly));
}
