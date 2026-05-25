// LiveMeetingContext.ts
// Helpers to merge real-time meeting transcripts into LLM chat context.

export const LIVE_MEETING_TRANSCRIPT_HEADER =
  "LIVE MEETING TRANSCRIPT (real-time — treat as what was actually said in this call):";

export function contextIncludesLiveMeetingTranscript(context?: string): boolean {
  if (!context?.trim()) return false;
  return (
    context.includes(LIVE_MEETING_TRANSCRIPT_HEADER) ||
    context.includes("[INTERVIEWER]:") ||
    context.includes("[ME]:") ||
    context.includes("[ASSISTANT (PREVIOUS SUGGESTION)]:") ||
    context.includes("[SESSION HISTORY - EARLIER DISCUSSION]")
  );
}

export function mergeLiveMeetingTranscriptIntoContext(
  existingContext: string | undefined,
  liveTranscript: string,
): string {
  const live = liveTranscript.trim();
  if (!live) return existingContext?.trim() ?? "";

  if (contextIncludesLiveMeetingTranscript(existingContext)) {
    return existingContext?.trim() ?? `${LIVE_MEETING_TRANSCRIPT_HEADER}\n${live}`;
  }

  if (!existingContext?.trim()) {
    return `${LIVE_MEETING_TRANSCRIPT_HEADER}\n${live}`;
  }

  return `${existingContext.trim()}\n\n---\n${LIVE_MEETING_TRANSCRIPT_HEADER}\n${live}`;
}
