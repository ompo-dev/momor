/** Human-readable labels for integration / STT kinds (settings UI). */
export const STT_KIND_LABELS: Record<string, string> = {
  deepgram: "Deepgram",
  groq: "Groq Whisper",
  openai: "OpenAI Whisper",
  google: "Google Cloud",
  "local-whisper": "Local Whisper",
  elevenlabs: "ElevenLabs",
  azure: "Azure Speech",
  soniox: "Soniox",
  ibmwatson: "IBM Watson",
  momor: "Momor",
};

export function sttKindLabel(kind: string, fallbackName?: string): string {
  if (fallbackName && fallbackName !== kind) return fallbackName;
  return STT_KIND_LABELS[kind] ?? fallbackName ?? kind;
}
