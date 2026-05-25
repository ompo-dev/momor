const ROLLING_SEP = "  ·  ";

function normalizeSegment(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** Loose compare for STT partial/final pairs (punctuation, casing). */
function normalizeForCompare(text: string): string {
  return normalizeSegment(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lastSegment(text: string): string {
  if (!text) return "";
  const lastSep = text.lastIndexOf(ROLLING_SEP);
  return normalizeSegment(
    lastSep >= 0 ? text.substring(lastSep + ROLLING_SEP.length) : text,
  );
}

function pickRicherSegment(a: string, b: string): string {
  const left = normalizeSegment(a);
  const right = normalizeSegment(b);
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  if (right.startsWith(left)) return right;
  if (left.startsWith(right)) return left;
  if (normalizeForCompare(left) === normalizeForCompare(right)) {
    return left.length >= right.length ? left : right;
  }
  return right;
}

function dedupeConsecutiveSegments(text: string): string {
  if (!text) return text;
  const parts = text
    .split(ROLLING_SEP)
    .map(normalizeSegment)
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(part);
      continue;
    }
    if (
      prev === part ||
      normalizeForCompare(prev) === normalizeForCompare(part)
    ) {
      out[out.length - 1] = pickRicherSegment(prev, part);
      continue;
    }
    out.push(part);
  }
  return out.join(ROLLING_SEP);
}

function segmentsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.startsWith(a) || a.startsWith(b)) return true;
  return normalizeForCompare(a) === normalizeForCompare(b);
}

function mergeOverlappingText(live: string, incoming: string): string {
  return pickRicherSegment(live, incoming);
}

function segmentAlreadyPresent(prev: string, incoming: string): boolean {
  if (!prev || !incoming) return false;
  return segmentsOverlap(lastSegment(prev), incoming);
}

/** Commit a finalized STT utterance onto the rolling bar (finals only). */
export function commitRollingSegment(committed: string, text: string): string {
  const incoming = normalizeSegment(text);
  if (!incoming) return committed;
  if (segmentAlreadyPresent(committed, incoming)) {
    return dedupeConsecutiveSegments(committed);
  }
  if (!committed) {
    return dedupeConsecutiveSegments(incoming);
  }
  return dedupeConsecutiveSegments(`${committed}${ROLLING_SEP}${incoming}`);
}

/** Merge live partial + final text, then commit once (mirrors meeting transcript). */
export function commitRollingWithLive(
  committed: string,
  live: string,
  finalText: string,
): string {
  const finalNorm = normalizeSegment(finalText);
  if (!finalNorm) return committed;

  const liveNorm = normalizeSegment(live);
  const segment =
    liveNorm && segmentsOverlap(liveNorm, finalNorm)
      ? mergeOverlappingText(liveNorm, finalNorm)
      : finalNorm;

  return commitRollingSegment(committed, segment);
}

/** Render committed finals plus the current live partial preview. */
export function mergeRollingPreview(committed: string, live: string): string {
  const liveNorm = normalizeSegment(live);
  if (!liveNorm) return committed;
  if (!committed) return liveNorm;

  const lastCommitted = lastSegment(committed);
  if (segmentsOverlap(lastCommitted, liveNorm)) {
    const prefix = committed.slice(
      0,
      committed.length - lastCommitted.length,
    );
    return dedupeConsecutiveSegments(`${prefix}${liveNorm}`);
  }

  return dedupeConsecutiveSegments(`${committed}${ROLLING_SEP}${liveNorm}`);
}

/**
 * @deprecated Prefer commitRollingWithLive + mergeRollingPreview in the UI layer.
 */
export function appendRollingSegment(
  prev: string,
  text: string,
  isFinal: boolean,
): string {
  const incoming = normalizeSegment(text);
  if (!incoming) return prev;

  const lastSep = prev.lastIndexOf(ROLLING_SEP);
  const committedPrefix =
    lastSep >= 0 ? prev.substring(0, lastSep + ROLLING_SEP.length) : "";
  const liveTail = lastSep >= 0 ? prev.substring(lastSep + ROLLING_SEP.length) : prev;
  const liveNorm = normalizeSegment(liveTail);
  const committedOnly = committedPrefix
    ? committedPrefix.slice(0, -ROLLING_SEP.length)
    : "";

  if (!isFinal) {
    if (!prev) return incoming;

    if (segmentAlreadyPresent(prev, incoming)) {
      return dedupeConsecutiveSegments(prev);
    }

    if (segmentsOverlap(liveNorm, incoming)) {
      if (committedPrefix) {
        return dedupeConsecutiveSegments(committedPrefix + incoming);
      }
      return incoming;
    }

    return dedupeConsecutiveSegments(`${prev}${ROLLING_SEP}${incoming}`);
  }

  if (segmentAlreadyPresent(prev, incoming)) {
    if (segmentsOverlap(liveNorm, incoming)) {
      const segment = mergeOverlappingText(liveNorm, incoming);
      if (!committedOnly) {
        return dedupeConsecutiveSegments(segment);
      }
      return dedupeConsecutiveSegments(`${committedOnly}${ROLLING_SEP}${segment}`);
    }
    return dedupeConsecutiveSegments(prev);
  }

  if (segmentsOverlap(liveNorm, incoming)) {
    const segment = mergeOverlappingText(liveNorm, incoming);
    if (!committedOnly) {
      return dedupeConsecutiveSegments(segment);
    }
    return dedupeConsecutiveSegments(`${committedOnly}${ROLLING_SEP}${segment}`);
  }

  if (!prev) {
    return dedupeConsecutiveSegments(incoming);
  }

  return dedupeConsecutiveSegments(`${prev}${ROLLING_SEP}${incoming}`);
}
