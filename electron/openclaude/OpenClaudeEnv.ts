/**
 * OpenClaudeEnv — pure mapping from a Momor provider selection to the
 * environment variables that make openclaude talk to that provider.
 *
 * openclaude (a Claude Code fork) picks its backend purely from env vars:
 *   - Anthropic:   ANTHROPIC_API_KEY
 *   - OpenAI-compat: CLAUDE_CODE_USE_OPENAI=1 + OPENAI_API_KEY (+ base url/model)
 *   - Gemini:      CLAUDE_CODE_USE_GEMINI=1 + GEMINI_API_KEY
 * DeepSeek / Groq / Ollama / custom are all OpenAI-compatible endpoints, so they
 * reuse the OPENAI_* variables with a provider-specific OPENAI_BASE_URL.
 *
 * This module has no I/O and no Momor dependencies — the caller (LLMHelper)
 * resolves the active provider + key from its own state and passes them in.
 */

export type OpenClaudeProvider =
  | "anthropic"
  | "openai"
  | "gemini"
  | "deepseek"
  | "groq"
  | "ollama"
  | "custom";

export interface ProviderEnvInput {
  provider: OpenClaudeProvider;
  apiKey?: string;
  /** Model id to pin (optional — openclaude uses its own default otherwise). */
  model?: string;
  /** Override base URL (custom providers / self-hosted). */
  baseUrl?: string;
  /** Custom OpenAI-compat auth header overrides. */
  authHeader?: string;
  authHeaderValue?: string;
  authScheme?: string;
}

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const OLLAMA_BASE_URL = "http://localhost:11434/v1";

type EnvMap = Record<string, string>;

function applyIfPresent(
  env: EnvMap,
  key: string,
  value?: string,
): void {
  const trimmed = value?.trim();
  if (trimmed) env[key] = trimmed;
}

function openaiCompat(
  apiKey?: string,
  baseUrl?: string,
  model?: string,
): EnvMap {
  const env: EnvMap = {
    CLAUDE_CODE_USE_OPENAI: "1",
  };
  applyIfPresent(env, "OPENAI_API_KEY", apiKey);
  applyIfPresent(env, "OPENAI_BASE_URL", baseUrl);
  applyIfPresent(env, "OPENAI_MODEL", model);
  return env;
}

/**
 * Build the openclaude env fragment for a provider. Returns only the vars that
 * should be set; the caller merges this over `process.env` for the spawn.
 */
export function buildOpenClaudeEnv(input: ProviderEnvInput): EnvMap {
  const { provider, apiKey, model, baseUrl } = input;
  switch (provider) {
    case "anthropic": {
      const env: EnvMap = {};
      applyIfPresent(env, "ANTHROPIC_API_KEY", apiKey);
      applyIfPresent(env, "ANTHROPIC_MODEL", model);
      applyIfPresent(env, "ANTHROPIC_BASE_URL", baseUrl);
      return env;
    }
    case "gemini": {
      const env: EnvMap = { CLAUDE_CODE_USE_GEMINI: "1" };
      applyIfPresent(env, "GEMINI_API_KEY", apiKey);
      applyIfPresent(env, "GEMINI_MODEL", model);
      applyIfPresent(env, "GEMINI_BASE_URL", baseUrl);
      return env;
    }
    case "openai":
      return openaiCompat(apiKey ?? "", baseUrl, model);
    case "deepseek":
      return openaiCompat(apiKey ?? "", baseUrl ?? DEEPSEEK_BASE_URL, model);
    case "groq":
      return openaiCompat(apiKey ?? "", baseUrl ?? GROQ_BASE_URL, model);
    case "ollama":
      return openaiCompat(apiKey || "ollama", baseUrl ?? OLLAMA_BASE_URL, model);
    case "custom": {
      const env = openaiCompat(apiKey ?? "", baseUrl, model);
      applyIfPresent(env, "OPENAI_AUTH_HEADER", input.authHeader);
      applyIfPresent(
        env,
        "OPENAI_AUTH_HEADER_VALUE",
        input.authHeaderValue,
      );
      applyIfPresent(env, "OPENAI_AUTH_SCHEME", input.authScheme);
      return env;
    }
    default:
      return {};
  }
}
