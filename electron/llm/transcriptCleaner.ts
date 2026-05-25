// electron/llm/transcriptCleaner.ts
// Deterministic transcript cleaner - NO LLM calls
// Fast string-based processing for interview copilot

export interface TranscriptTurn {
    role: 'interviewer' | 'user' | 'assistant';
    text: string;
    timestamp: number;
}

/**
 * Filler words and verbal acknowledgements to remove
 */
const FILLER_WORDS = new Set([
    'uh', 'um', 'ah', 'hmm', 'hm', 'er', 'erm',
    'like', 'you know', 'i mean', 'basically', 'actually',
    'so', 'well', 'anyway', 'anyways'
]);

const ACKNOWLEDGEMENTS = new Set([
    'okay', 'ok', 'yeah', 'yes', 'right', 'sure', 'got it',
    'gotcha', 'uh-huh', 'uh huh', 'mm-hmm', 'mm hmm', 'mhm',
    'cool', 'great', 'nice', 'perfect', 'alright', 'all right'
]);

/** Spoken numbers and short numeric phrases must survive cleaning (e.g. "7 9 1"). */
function hasNumericContent(text: string): boolean {
    return /\d/.test(text);
}

/**
 * Clean a single turn's text
 * Removes fillers, acknowledgements, and cleans up formatting
 */
function cleanText(text: string): string {
    let result = text.toLowerCase().trim();

    // Remove repeated words (yeah yeah, okay okay)
    result = result.replace(/\b(\w+)(\s+\1)+\b/gi, '$1');

    // Split into words and filter
    const words = result.split(/\s+/);
    const cleaned = words.filter(word => {
        const normalized = word.replace(/[.,!?;:]/g, '');
        return !FILLER_WORDS.has(normalized) &&
            !ACKNOWLEDGEMENTS.has(normalized);
    });

    // Reconstruct
    result = cleaned.join(' ').trim();

    // Clean up punctuation
    result = result.replace(/\s+([.,!?;:])/g, '$1');
    result = result.replace(/([.,!?;:])+/g, '$1');
    result = result.replace(/\s+/g, ' ');

    return result;
}

/**
 * Check if a turn is meaningful enough to keep
 */
function isMeaningfulTurn(turn: TranscriptTurn, cleanedText: string): boolean {
    const trimmed = cleanedText.trim();
    if (!trimmed) return false;

    // Never drop spoken numbers — critical for recall / repeat-back requests.
    if (hasNumericContent(trimmed) && trimmed.length >= 2) {
        return true;
    }

    // Always keep interviewer speech (priority)
    if (turn.role === 'interviewer' && trimmed.length >= 3) {
        return true;
    }

    // Keep candidate (user) speech more aggressively than filler filtering.
    if (turn.role === 'user' && trimmed.length >= 3) {
        return true;
    }

    // Minimum 3 words for assistant / other roles
    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 3) {
        return false;
    }

    if (trimmed.length < 10) {
        return false;
    }

    return true;
}

/**
 * Clean transcript buffer
 * Removes fillers, acknowledgements, and non-meaningful turns
 * Returns cleaned array preserving order
 */
export function cleanTranscript(turns: TranscriptTurn[]): TranscriptTurn[] {
    const cleaned: TranscriptTurn[] = [];

    for (const turn of turns) {
        const cleanedText = cleanText(turn.text);

        if (isMeaningfulTurn(turn, cleanedText)) {
            cleaned.push({
                role: turn.role,
                text: cleanedText,
                timestamp: turn.timestamp
            });
        }
    }

    return cleaned;
}

/**
 * Sparsify transcript to target turn count
 * Prioritizes interviewer speech, keeps recent context
 * Target: 8-12 turns, ~300-600 tokens
 */
export function sparsifyTranscript(
    turns: TranscriptTurn[],
    maxTurns: number = 12
): TranscriptTurn[] {
    if (turns.length <= maxTurns) {
        return [...turns].sort((a, b) => a.timestamp - b.timestamp);
    }

    const userTurns = turns.filter(t => t.role === 'user');
    const interviewerTurns = turns.filter(t => t.role === 'interviewer');
    const assistantTurns = turns.filter(t => t.role === 'assistant');

    // Always keep all candidate (ME) turns — losing them breaks recall questions.
    const keptUser = userTurns;
    const recentInterviewer = interviewerTurns.slice(-6);
    const remainingSlots = Math.max(
        0,
        maxTurns - keptUser.length - recentInterviewer.length,
    );
    const recentAssistant = assistantTurns.slice(-remainingSlots);

    const result = [...keptUser, ...recentInterviewer, ...recentAssistant];
    result.sort((a, b) => a.timestamp - b.timestamp);

    return result;
}

/**
 * Format cleaned transcript for LLM input
 */
export function formatTranscriptForLLM(turns: TranscriptTurn[]): string {
    return turns.map(turn => {
        const label = turn.role === 'interviewer' ? 'INTERVIEWER' :
            turn.role === 'user' ? 'ME' : 'ASSISTANT';
        return `[${label}]: ${turn.text}`;
    }).join('\n');
}

/**
 * Full pipeline: clean, sparsify, format
 */
export function prepareTranscriptForWhatToAnswer(
    turns: TranscriptTurn[],
    maxTurns: number = 16
): string {
    const cleaned = cleanTranscript(turns);
    const sparsified = sparsifyTranscript(cleaned, maxTurns);
    return formatTranscriptForLLM(sparsified);
}

/**
 * Prefer the richer transcript source so short spoken numbers are not lost.
 */
export function resolveTranscriptForWhatToAnswer(
    rawFormatted: string,
    preparedFormatted: string,
): string {
    const raw = rawFormatted.trim();
    const prepared = preparedFormatted.trim();
    if (!prepared) return raw;
    if (!raw) return prepared;

    const rawDigitCount = (raw.match(/\d/g) || []).length;
    const preparedDigitCount = (prepared.match(/\d/g) || []).length;
    if (rawDigitCount > preparedDigitCount) return raw;

    if (raw.length > prepared.length * 1.15) return raw;
    return prepared;
}
