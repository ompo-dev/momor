/**
 * Filters common Whisper hallucinations and repetition loops.
 * Returns an empty string if the text is a known hallucination,
 * otherwise returns the trimmed text.
 */

const EXACT_BLOCKS = new Set([
  // English
  '[music]', '[applause]', '[inaudible]', '[noise]', '[blank_audio]',
  '(music)', '(applause)',
  'thank you for watching', 'thanks for watching',
  'you', 'bye', '...', '.', 'uh', 'um',
  // Portuguese
  'obrigado', 'obrigada', 'obrigado.', 'obrigada.',
  'por favor', 'sim', 'não',
  // Single-char / punctuation only
  ',', ';', ':', '!', '?',
]);

// Purely bracketed tags: [Music], [BLANK_AUDIO], [Inaudible], etc.
const BRACKET_TOKEN_RE = /^\[.*\]$/;

// Punctuation-only (no word characters)
const PUNCT_ONLY_RE = /^[\s.,!?;:…\-–—]+$/;

/**
 * Detects repetition loops — a hallmark of Whisper hallucinations on near-silent
 * or very repetitive audio (e.g. "thank you. thank you. thank you.").
 *
 * Strategy: build bigrams (pairs of consecutive words) and count occurrences.
 * If any bigram appears >= 3 times, or any single word makes up > 60% of all
 * words, the output is a loop.
 */
function hasRepetitionLoop(words: string[]): boolean {
  if (words.length < 4) return false;

  // Single-word frequency check
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  for (const [, count] of freq) {
    if (count / words.length > 0.6) return true;
  }

  // Bigram repetition check
  if (words.length >= 4) {
    const bigramFreq = new Map<string, number>();
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const n = (bigramFreq.get(bigram) ?? 0) + 1;
      bigramFreq.set(bigram, n);
      if (n >= 3) return true;
    }
  }

  return false;
}

export function filterHallucination(text: string): string {
  const trimmed = text.trim();

  // Too short
  if (trimmed.length < 2) return '';

  // Punctuation only
  if (PUNCT_ONLY_RE.test(trimmed)) return '';

  const lower = trimmed.toLowerCase();

  // Exact match against known hallucinations
  if (EXACT_BLOCKS.has(lower)) return '';

  // Any token that is purely a bracketed tag
  if (BRACKET_TOKEN_RE.test(trimmed)) return '';

  // Repetition loop detection
  const words = lower.split(/\s+/).filter(Boolean);
  if (hasRepetitionLoop(words)) return '';

  return trimmed;
}
