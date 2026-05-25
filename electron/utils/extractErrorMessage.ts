/**
 * Normalize unknown thrown/emitted values (Deepgram SDK ErrorEvent, Axios, etc.)
 * into a human-readable string for logging and UI.
 */

function isUnhelpfulMessage(msg: string | undefined): boolean {
  if (!msg) return true;
  const trimmed = msg.trim();
  return trimmed === "" || trimmed === "[object Object]" || trimmed === "Unknown error";
}

function extractFromRecord(o: Record<string, unknown>): string | undefined {
  const stringFields = [
    "message",
    "reason",
    "description",
    "statusText",
    "statusMessage",
    "error",
  ];

  for (const field of stringFields) {
    const value = o[field];
    if (typeof value === "string" && !isUnhelpfulMessage(value)) {
      return value;
    }
    if (value instanceof Error) {
      const nested = extractErrorMessage(value);
      if (!isUnhelpfulMessage(nested)) return nested;
    }
    if (value && typeof value === "object") {
      const nested = extractFromRecord(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }

  const nestedError = o.error;
  if (nestedError instanceof Error && !isUnhelpfulMessage(nestedError.message)) {
    return nestedError.message;
  }

  // Node `ws` ErrorEvent stores the real text on symbol keys (kMessage / kError).
  for (const sym of Object.getOwnPropertySymbols(o)) {
    const value = (o as Record<string | symbol, unknown>)[sym];
    if (typeof value === "string" && !isUnhelpfulMessage(value)) {
      return value;
    }
    if (value instanceof Error && !isUnhelpfulMessage(value.message)) {
      return value.message;
    }
  }

  for (const key of Object.getOwnPropertyNames(o)) {
    const value = o[key];
    if (typeof value === "string" && !isUnhelpfulMessage(value)) {
      if (/\b40[13]\b|invalid credentials|unauthorized|authentication/i.test(value)) {
        return value;
      }
    }
    if (value instanceof Error && !isUnhelpfulMessage(value.message)) {
      return value.message;
    }
  }

  return undefined;
}

export function extractErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;

  if (err instanceof Error) {
    if (!isUnhelpfulMessage(err.message)) return err.message;
    if (err.cause) {
      const fromCause = extractErrorMessage(err.cause);
      if (!isUnhelpfulMessage(fromCause)) return fromCause;
    }
    const fromObject = extractFromRecord(err as unknown as Record<string, unknown>);
    if (fromObject) return fromObject;
    return err.name || "Unknown error";
  }

  if (err && typeof err === "object") {
    const fromObject = extractFromRecord(err as Record<string, unknown>);
    if (fromObject) return fromObject;
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}" && json !== "[object Object]") return json;
    } catch {
      // fall through
    }
  }

  const fallback = String(err);
  return isUnhelpfulMessage(fallback) ? "Unknown STT provider error" : fallback;
}

/** Detect auth/account errors that must not trigger reconnect loops. */
export function isSttAuthError(message: string, httpStatus = 0): boolean {
  const lower = message.toLowerCase();
  return (
    httpStatus === 401 ||
    /\b401\b/.test(message) ||
    lower.includes("invalid credentials") ||
    lower.includes("invalid_key") ||
    lower.includes("invalid api") ||
    lower.includes("authentication") ||
    lower.includes("auth_timeout") ||
    lower.includes("auth_error") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid_key_format") ||
    lower.includes("unexpected server response: 401")
  );
}
