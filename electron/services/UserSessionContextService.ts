// UserSessionContextService.ts
// Stores "About you", current session, and AI behavior profiles synced from the renderer.
// Injected into every main-process LLM pipeline during calls.

export interface AiBehaviorProfile {
  id: string;
  name: string;
  behaviorPrompt: string;
  isDefault?: boolean;
  activeListening?: boolean;
  autoSuggestResponses?: boolean;
}

export interface UserSessionData {
  personalContext: string;
  sessionContext: string;
  profiles: AiBehaviorProfile[];
}

export interface UserSessionSyncPayload {
  personalContext: string;
  sessionContext: string;
  profiles: AiBehaviorProfile[];
  activeProfileId: string | null;
}

const DEFAULT_PROFILE: AiBehaviorProfile = {
  id: "default",
  name: "Padrão",
  behaviorPrompt: "",
  isDefault: true,
};

export class UserSessionContextService {
  private static instance: UserSessionContextService | null = null;

  private data: UserSessionData = {
    personalContext: "",
    sessionContext: "",
    profiles: [{ ...DEFAULT_PROFILE }],
  };

  private activeProfileId: string | null = null;

  static getInstance(): UserSessionContextService {
    if (!UserSessionContextService.instance) {
      UserSessionContextService.instance = new UserSessionContextService();
    }
    return UserSessionContextService.instance;
  }

  sync(payload: UserSessionSyncPayload): void {
    this.data = {
      personalContext: payload.personalContext ?? "",
      sessionContext: payload.sessionContext ?? "",
      profiles: this.normalizeProfiles(payload.profiles ?? []),
    };
    this.activeProfileId = payload.activeProfileId ?? null;
  }

  getActiveProfile(): AiBehaviorProfile {
    const profiles = this.data.profiles;
    if (this.activeProfileId) {
      const match = profiles.find((p) => p.id === this.activeProfileId);
      if (match) return match;
    }
    return (
      profiles.find((p) => p.isDefault) ??
      profiles[0] ??
      DEFAULT_PROFILE
    );
  }

  /** True when any user/session/profile field has content. */
  hasContext(): boolean {
    return this.buildContextBlock().length > 0;
  }

  buildContextBlock(): string {
    const sections: string[] = [];
    const profile = this.getActiveProfile();

    if (this.data.personalContext.trim()) {
      sections.push(
        `## About the user\n${this.data.personalContext.trim()}`,
      );
    }

    if (this.data.sessionContext.trim()) {
      sections.push(
        `## Current session\n${this.data.sessionContext.trim()}`,
      );
    }

    if (profile.behaviorPrompt.trim()) {
      sections.push(
        `## AI behavior rules\nFollow these rules for every response:\n${profile.behaviorPrompt.trim()}`,
      );
    }

    return sections.join("\n\n");
  }

  mergeWithContext(conversationContext?: string): string {
    const block = this.buildContextBlock();
    const conv = conversationContext?.trim() ?? "";
    if (!block && !conv) return "";
    if (!block) return conv;
    if (!conv) return block;
    return `${block}\n\n---\nCONVERSATION:\n${conv}`;
  }

  enrichSystemPrompt(basePrompt: string): string {
    const block = this.buildContextBlock();
    if (!block) return basePrompt;
    return `${basePrompt}\n\n---\nUSER & SESSION CONTEXT:\n${block}`;
  }

  /** Skip re-merge when renderer already prefixed user context. */
  contextAlreadyIncludesUserSession(context?: string): boolean {
    if (!context?.trim()) return false;
    return (
      context.includes("## About the user") ||
      context.includes("<user_session_context") ||
      context.includes("USER & SESSION CONTEXT:")
    );
  }

  mergeIfNeeded(conversationContext?: string): string {
    if (this.contextAlreadyIncludesUserSession(conversationContext)) {
      return conversationContext?.trim() ?? "";
    }
    return this.mergeWithContext(conversationContext);
  }

  private normalizeProfiles(profiles: AiBehaviorProfile[]): AiBehaviorProfile[] {
    if (!profiles.length) {
      return [{ ...DEFAULT_PROFILE }];
    }
    const hasDefault = profiles.some((p) => p.isDefault);
    if (!hasDefault) {
      return profiles.map((p, i) => ({ ...p, isDefault: i === 0 }));
    }
    return profiles;
  }
}
