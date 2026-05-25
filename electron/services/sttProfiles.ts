import { randomBytes } from "crypto";

/** Subset of stored credentials used by STT profile helpers (avoids circular imports). */
export type SttCredentialsSlice = {
  sttProvider?: string;
  groqSttApiKey?: string;
  groqSttModel?: string;
  openAiSttApiKey?: string;
  openAiSttBaseUrl?: string;
  deepgramApiKey?: string;
  elevenLabsApiKey?: string;
  azureApiKey?: string;
  azureRegion?: string;
  ibmWatsonApiKey?: string;
  ibmWatsonRegion?: string;
  sonioxApiKey?: string;
  googleServiceAccountPath?: string;
  momorApiKey?: string;
  sttProfiles?: SttProfile[];
  defaultSttProfileId?: string | null;
};

export type SttProfileKind =
  | "none"
  | "google"
  | "groq"
  | "openai"
  | "deepgram"
  | "elevenlabs"
  | "azure"
  | "ibmwatson"
  | "soniox"
  | "momor"
  | "local-whisper";

export interface SttProfile {
  id: string;
  name: string;
  kind: SttProfileKind;
  enabled: boolean;
  apiKey?: string;
  backupApiKeys?: string[];
  serviceAccountPath?: string;
  region?: string;
  baseUrl?: string;
  model?: string;
}

export const STT_PRESET_CATALOG: Array<{
  kind: SttProfileKind;
  name: string;
}> = [
  { kind: "deepgram", name: "Deepgram" },
  { kind: "groq", name: "Groq Whisper" },
  { kind: "openai", name: "OpenAI Whisper" },
  { kind: "google", name: "Google Cloud" },
  { kind: "local-whisper", name: "Local Whisper" },
  { kind: "elevenlabs", name: "ElevenLabs" },
  { kind: "azure", name: "Azure Speech" },
  { kind: "soniox", name: "Soniox" },
  { kind: "ibmwatson", name: "IBM Watson" },
];

export function newSttProfileId(): string {
  return `stt_${randomBytes(6).toString("hex")}`;
}

function hasKey(value?: string): boolean {
  return !!(value && value.trim().length > 0);
}

export function isSttProfileConfigured(
  profile: SttProfile,
  creds: SttCredentialsSlice,
): boolean {
  if (!profile.enabled || profile.kind === "none") return false;
  if (profile.kind === "google") {
    return hasKey(profile.serviceAccountPath ?? creds.googleServiceAccountPath);
  }
  if (profile.kind === "local-whisper") return true;
  if (profile.kind === "momor") return hasKey(creds.momorApiKey);
  return hasKey(profile.apiKey);
}

export function maskSttProfile(profile: SttProfile): SttProfile & {
  hasApiKey: boolean;
  configured: boolean;
} {
  const maskedKey = profile.apiKey
    ? `sk-...${profile.apiKey.slice(-4)}`
    : "";
  const maskedBackups = profile.backupApiKeys?.length
    ? profile.backupApiKeys.map((k) => `sk-...${k.slice(-4)}`)
    : undefined;
  return {
    ...profile,
    apiKey: maskedKey || undefined,
    backupApiKeys: maskedBackups,
    hasApiKey: hasKey(profile.apiKey),
    configured: false,
  };
}

export function maskSttProfiles(
  profiles: SttProfile[],
  creds: SttCredentialsSlice,
): Array<
  SttProfile & { hasApiKey: boolean; configured: boolean; apiKey?: string }
> {
  return profiles.map((p) => {
    const configured = isSttProfileConfigured(p, creds);
    const m = maskSttProfile(p);
    return { ...m, configured };
  });
}

function legacyKeyForKind(
  creds: SttCredentialsSlice,
  kind: SttProfileKind,
): string | undefined {
  switch (kind) {
    case "groq":
      return creds.groqSttApiKey;
    case "openai":
      return creds.openAiSttApiKey;
    case "deepgram":
      return creds.deepgramApiKey;
    case "elevenlabs":
      return creds.elevenLabsApiKey;
    case "azure":
      return creds.azureApiKey;
    case "ibmwatson":
      return creds.ibmWatsonApiKey;
    case "soniox":
      return creds.sonioxApiKey;
    default:
      return undefined;
  }
}

function presetName(kind: SttProfileKind): string {
  return STT_PRESET_CATALOG.find((p) => p.kind === kind)?.name ?? kind;
}

export function migrateSttProfiles(creds: SttCredentialsSlice): void {
  if (creds.sttProfiles && creds.sttProfiles.length > 0) return;

  const profiles: SttProfile[] = [];
  const legacyKind = (creds.sttProvider || "none") as SttProfileKind;

  if (legacyKind !== "none") {
    profiles.push({
      id: newSttProfileId(),
      name: presetName(legacyKind),
      kind: legacyKind,
      enabled: true,
      apiKey: legacyKeyForKind(creds, legacyKind),
      serviceAccountPath: creds.googleServiceAccountPath,
      region:
        legacyKind === "azure"
          ? creds.azureRegion
          : legacyKind === "ibmwatson"
            ? creds.ibmWatsonRegion
            : undefined,
      baseUrl: legacyKind === "openai" ? creds.openAiSttBaseUrl : undefined,
      model: legacyKind === "groq" ? creds.groqSttModel : undefined,
    });
  }

  for (const preset of STT_PRESET_CATALOG) {
    if (profiles.some((p) => p.kind === preset.kind)) continue;
    const key = legacyKeyForKind(creds, preset.kind);
    const hasGoogle =
      preset.kind === "google" && hasKey(creds.googleServiceAccountPath);
    if (!key && !hasGoogle) continue;
    profiles.push({
      id: newSttProfileId(),
      name: preset.name,
      kind: preset.kind,
      enabled: true,
      apiKey: key,
      serviceAccountPath:
        preset.kind === "google" ? creds.googleServiceAccountPath : undefined,
      region:
        preset.kind === "azure"
          ? creds.azureRegion
          : preset.kind === "ibmwatson"
            ? creds.ibmWatsonRegion
            : undefined,
      baseUrl: preset.kind === "openai" ? creds.openAiSttBaseUrl : undefined,
      model: preset.kind === "groq" ? creds.groqSttModel : undefined,
    });
  }

  creds.sttProfiles = profiles;
  creds.defaultSttProfileId =
    profiles.find((p) => p.kind === legacyKind)?.id ??
    profiles.find((p) => isSttProfileConfigured(p, creds))?.id ??
    profiles[0]?.id ??
    null;
}

export function resolveActiveSttProfile(
  creds: SttCredentialsSlice,
  sessionProfileId?: string | null,
): SttProfile | null {
  const profiles = creds.sttProfiles ?? [];
  if (profiles.length === 0) return null;

  const pick =
    (sessionProfileId &&
      profiles.find((p) => p.id === sessionProfileId && p.enabled)) ||
    (creds.defaultSttProfileId &&
      profiles.find((p) => p.id === creds.defaultSttProfileId && p.enabled)) ||
    profiles.find((p) => p.enabled);

  return pick ?? null;
}

/** Keep legacy flat fields in sync for code paths that still read them. */
export function syncLegacySttFields(
  creds: SttCredentialsSlice,
  profile: SttProfile | null,
): void {
  if (!profile) {
    creds.sttProvider = "none";
    return;
  }
  creds.sttProvider = profile.kind;
  switch (profile.kind) {
    case "groq":
      if (profile.apiKey !== undefined) creds.groqSttApiKey = profile.apiKey;
      if (profile.model) creds.groqSttModel = profile.model;
      break;
    case "openai":
      if (profile.apiKey !== undefined) creds.openAiSttApiKey = profile.apiKey;
      if (profile.baseUrl !== undefined)
        creds.openAiSttBaseUrl = profile.baseUrl || undefined;
      break;
    case "deepgram":
      if (profile.apiKey !== undefined) creds.deepgramApiKey = profile.apiKey;
      break;
    case "elevenlabs":
      if (profile.apiKey !== undefined)
        creds.elevenLabsApiKey = profile.apiKey;
      break;
    case "azure":
      if (profile.apiKey !== undefined) creds.azureApiKey = profile.apiKey;
      if (profile.region) creds.azureRegion = profile.region;
      break;
    case "ibmwatson":
      if (profile.apiKey !== undefined) creds.ibmWatsonApiKey = profile.apiKey;
      if (profile.region) creds.ibmWatsonRegion = profile.region;
      break;
    case "soniox":
      if (profile.apiKey !== undefined) creds.sonioxApiKey = profile.apiKey;
      break;
    case "google":
      if (profile.serviceAccountPath)
        creds.googleServiceAccountPath = profile.serviceAccountPath;
      break;
    default:
      break;
  }
}
