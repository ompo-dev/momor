export type CloudProviderId = "gemini" | "groq" | "openai" | "claude" | "deepseek";
export type LocalProviderId = "codex-cli" | "openclaude" | "ollama" | "custom";
export type IntegrationId = CloudProviderId | LocalProviderId;

export const PINNED_INTEGRATIONS_KEY = "momor_pinned_integrations";

export const INTEGRATION_META: Record<
  IntegrationId,
  { label: string; category: "cloud" | "local" }
> = {
  gemini: { label: "Gemini", category: "cloud" },
  groq: { label: "Groq", category: "cloud" },
  openai: { label: "OpenAI", category: "cloud" },
  claude: { label: "Claude", category: "cloud" },
  deepseek: { label: "DeepSeek", category: "cloud" },
  "codex-cli": { label: "Codex CLI (ChatGPT)", category: "local" },
  openclaude: { label: "Claude Code (OpenClaude)", category: "local" },
  ollama: { label: "Ollama", category: "local" },
  custom: { label: "Custom provider", category: "local" },
};

export function readPinnedIntegrations(): IntegrationId[] {
  try {
    const raw = localStorage.getItem(PINNED_INTEGRATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IntegrationId[];
    return parsed.filter((id) => id in INTEGRATION_META);
  } catch {
    return [];
  }
}

export function writePinnedIntegrations(ids: IntegrationId[]) {
  localStorage.setItem(PINNED_INTEGRATIONS_KEY, JSON.stringify(ids));
}
