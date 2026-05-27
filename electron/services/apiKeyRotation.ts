export type LlmProviderId =
  | "gemini"
  | "groq"
  | "openai"
  | "claude"
  | "deepseek"
  | "momor";

export function normalizeApiKeyList(keys: string[]): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const key of keys) {
    const trimmed = key?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    pool.push(trimmed);
  }
  return pool;
}

export function mergeLegacyApiKeys(
  primary?: string,
  backups?: string[],
): string[] {
  return normalizeApiKeyList([primary ?? "", ...(backups ?? [])]);
}

/** @deprecated Use normalizeApiKeyList / mergeLegacyApiKeys */
export function buildApiKeyPool(
  primary?: string,
  backups?: string[],
): string[] {
  return mergeLegacyApiKeys(primary, backups);
}

export function maskApiKeyList(keys: string[]): string[] {
  return keys.map((key) =>
    key.length > 4 ? `sk-...${key.slice(-4)}` : "sk-...****",
  );
}

export function isRecoverableKeyError(error: unknown): boolean {
  const err = error as {
    message?: string;
    status?: number;
    statusCode?: number;
    code?: number | string;
  };
  const status = err.status ?? err.statusCode ?? 0;
  const msg = (err.message ?? "").toLowerCase();
  const code = String(err.code ?? "").toLowerCase();

  if (status === 401 || status === 403 || status === 429 || status === 402) {
    return true;
  }

  return (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("insufficient") ||
    msg.includes("billing") ||
    msg.includes("exceeded") ||
    msg.includes("invalid api") ||
    msg.includes("invalid key") ||
    msg.includes("authentication") ||
    msg.includes("unauthorized") ||
    msg.includes("permission denied") ||
    msg.includes("transcription_quota_exceeded") ||
    code === "insufficient_quota"
  );
}
