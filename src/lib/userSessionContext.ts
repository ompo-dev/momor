export interface AiBehaviorProfile {
  id: string;
  name: string;
  behaviorPrompt: string;
  isDefault?: boolean;
  /** Keeps Answer Now / call mic session on during meetings. */
  activeListening?: boolean;
  /** When active listening is on, auto-suggest answers on interviewer questions. */
  autoSuggestResponses?: boolean;
}

export interface UserSessionData {
  personalContext: string;
  sessionContext: string;
  profiles: AiBehaviorProfile[];
}

const STORAGE_KEY = "momor_user_session_context_v1";
const ACTIVE_PROFILE_KEY = "momor_active_ai_profile_v1";
export const USER_CONTEXT_CHANGED_EVENT = "momor-user-context-changed";

const DEFAULT_PROFILE: AiBehaviorProfile = {
  id: "default",
  name: "Padrão",
  behaviorPrompt: "",
  isDefault: true,
};

function createId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultUserSessionData(): UserSessionData {
  return {
    personalContext: "",
    sessionContext: "",
    profiles: [{ ...DEFAULT_PROFILE }],
  };
}

function normalizeProfiles(profiles: AiBehaviorProfile[]): AiBehaviorProfile[] {
  if (!profiles.length) {
    return [{ ...DEFAULT_PROFILE }];
  }

  const hasDefault = profiles.some((p) => p.isDefault);
  if (!hasDefault) {
    return profiles.map((p, i) => ({ ...p, isDefault: i === 0 }));
  }
  return profiles;
}

export function loadUserSessionData(): UserSessionData {
  if (typeof window === "undefined") {
    return createDefaultUserSessionData();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultUserSessionData();

    const parsed = JSON.parse(raw) as Partial<UserSessionData>;
    return {
      personalContext: parsed.personalContext ?? "",
      sessionContext: parsed.sessionContext ?? "",
      profiles: normalizeProfiles(
        Array.isArray(parsed.profiles) ? parsed.profiles : [],
      ),
    };
  } catch {
    return createDefaultUserSessionData();
  }
}

export function saveUserSessionData(data: UserSessionData): void {
  if (typeof window === "undefined") return;

  const normalized: UserSessionData = {
    personalContext: data.personalContext,
    sessionContext: data.sessionContext,
    profiles: normalizeProfiles(data.profiles),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(USER_CONTEXT_CHANGED_EVENT));
}

export function getActiveAiProfileId(): string | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
  if (stored) return stored;

  const data = loadUserSessionData();
  return data.profiles.find((p) => p.isDefault)?.id ?? data.profiles[0]?.id ?? null;
}

export function setActiveAiProfileId(profileId: string): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  window.dispatchEvent(new CustomEvent(USER_CONTEXT_CHANGED_EVENT));
}

export function getProfileById(
  data: UserSessionData,
  profileId: string | null,
): AiBehaviorProfile | null {
  if (!profileId) return null;
  return data.profiles.find((p) => p.id === profileId) ?? null;
}

export function getActiveProfile(data: UserSessionData): AiBehaviorProfile {
  const activeId = getActiveAiProfileId();
  return (
    getProfileById(data, activeId) ??
    data.profiles.find((p) => p.isDefault) ??
    data.profiles[0] ??
    DEFAULT_PROFILE
  );
}

export function buildUserSessionContextBlock(
  data: UserSessionData,
  profileId?: string | null,
): string {
  const sections: string[] = [];
  const profile = profileId
    ? getProfileById(data, profileId) ?? getActiveProfile(data)
    : getActiveProfile(data);

  if (data.personalContext.trim()) {
    sections.push(
      `## About the user\n${data.personalContext.trim()}`,
    );
  }

  if (data.sessionContext.trim()) {
    sections.push(
      `## Current session\n${data.sessionContext.trim()}`,
    );
  }

  if (profile.behaviorPrompt.trim()) {
    sections.push(
      `## AI behavior rules\nFollow these rules for every response:\n${profile.behaviorPrompt.trim()}`,
    );
  }

  return sections.join("\n\n");
}

export function enrichSystemPromptWithUserContext(
  basePrompt: string,
  data: UserSessionData,
  profileId?: string | null,
): string {
  const block = buildUserSessionContextBlock(data, profileId);
  if (!block) return basePrompt;
  return `${basePrompt}\n\n---\nUSER & SESSION CONTEXT:\n${block}`;
}

export function mergeConversationContextWithUserSession(
  conversationContext: string,
  data: UserSessionData,
  profileId?: string | null,
): string {
  const block = buildUserSessionContextBlock(data, profileId);
  if (!block && !conversationContext) return "";
  if (!block) return conversationContext;
  if (!conversationContext) return block;
  return `${block}\n\n---\nCONVERSATION SO FAR:\n${conversationContext}`;
}

export function createAiBehaviorProfile(name: string): AiBehaviorProfile {
  return {
    id: createId(),
    name: name.trim() || "Novo perfil",
    behaviorPrompt: "",
    isDefault: false,
    activeListening: false,
    autoSuggestResponses: true,
  };
}

export function getActiveProfileListeningFlags(profile: AiBehaviorProfile): {
  activeListening: boolean;
  autoSuggestResponses: boolean;
} {
  const activeListening = profile.activeListening === true;
  return {
    activeListening,
    autoSuggestResponses:
      activeListening && profile.autoSuggestResponses !== false,
  };
}

export const SESSION_PRESET_KEYS = [
  "interview",
  "meeting",
  "codeReview",
  "presentation",
  "sales",
] as const;

export type SessionPresetKey = (typeof SESSION_PRESET_KEYS)[number];
