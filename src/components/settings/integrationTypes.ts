export type CloudProviderId = "gemini" | "groq" | "openai" | "claude" | "deepseek";
export type LocalProviderId = "codex-cli" | "openclaude" | "ollama" | "custom";
export type IntegrationId = CloudProviderId | LocalProviderId;

export const PINNED_INTEGRATIONS_KEY = "momor_pinned_integrations";

export const INTEGRATION_META: Record<
  IntegrationId,
  { label: string; category: "cloud" | "local"; hidden?: boolean }
> = {
  gemini: { label: "Gemini", category: "cloud" },
  groq: { label: "Groq", category: "cloud" },
  openai: { label: "OpenAI", category: "cloud" },
  claude: { label: "Claude", category: "cloud" },
  deepseek: { label: "DeepSeek", category: "cloud" },
  "codex-cli": { label: "Codex CLI (ChatGPT)", category: "local" },
  openclaude: {
    label: "Claude Code",
    category: "local",
    hidden: true,
  },
  ollama: { label: "Ollama", category: "local" },
  custom: { label: "Custom endpoint", category: "local" },
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
