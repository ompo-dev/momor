// Detect "/" (skills) and "@" (mcps) autocomplete triggers in a text input.

export type MentionTrigger = "/" | "@";

export interface MentionMatch {
  trigger: MentionTrigger;
  /** Query text typed after the trigger (may be empty). */
  query: string;
  /** Index of the trigger char in the text. */
  start: number;
  /** Caret index (end of the query). */
  end: number;
}

/**
 * Returns the active mention being typed at `caret`, or null.
 * A trigger is active when it sits at the start of the text or right after
 * whitespace, and only word characters follow it up to the caret.
 */
export function detectMention(text: string, caret: number): MentionMatch | null {
  const upto = text.slice(0, caret);
  // Match a trigger preceded by start-or-space, then word-ish chars to the caret.
  const m = /(^|\s)([/@])([\w-]*)$/.exec(upto);
  if (!m) return null;
  const trigger = m[2] as MentionTrigger;
  const query = m[3] ?? "";
  const start = caret - query.length - 1; // index of the trigger char
  return { trigger, query, start, end: caret };
}

/** Replace the active mention token with `insert` + a trailing space. */
export function applyMention(
  text: string,
  match: MentionMatch,
  insert: string,
): { text: string; caret: number } {
  const before = text.slice(0, match.start);
  const after = text.slice(match.end);
  const token = `${match.trigger}${insert} `;
  const next = `${before}${token}${after}`;
  return { text: next, caret: before.length + token.length };
}
