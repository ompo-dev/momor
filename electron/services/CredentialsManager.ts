/**
 * CredentialsManager - Secure storage for API keys and service account paths
 * Uses Electron's safeStorage API for encryption at rest
 */

import { app, safeStorage } from "electron";
import fs from "fs";
import path from "path";
import {
  buildApiKeyPool,
  mergeLegacyApiKeys,
  maskApiKeyList,
  normalizeApiKeyList,
  type LlmProviderId,
} from "./apiKeyRotation";
import {
  applySttProfileApiKeys,
  getSttProfileApiKeys,
  migrateSttProfiles,
  exposeSttProfilesForSettings,
  newSttProfileId,
  resolveActiveSttProfile,
  syncLegacySttFields,
  type SttProfile,
  type SttProfileKind,
} from "./sttProfiles";
export type { SttProfile, SttProfileKind } from "./sttProfiles";

const CREDENTIALS_PATH = path.join(app.getPath("userData"), "credentials.enc");

export interface CustomProvider {
  id: string;
  name: string;
  curlCommand: string;
}

export interface CurlProvider {
  id: string;
  name: string;
  curlCommand: string;
  responsePath: string; // e.g. "choices[0].message.content"
}

export interface StoredCredentials {
  geminiApiKey?: string;
  geminiApiKeys?: string[];
  geminiBackupApiKeys?: string[];
  groqApiKey?: string;
  groqApiKeys?: string[];
  groqBackupApiKeys?: string[];
  openaiApiKey?: string;
  openaiApiKeys?: string[];
  openaiBackupApiKeys?: string[];
  claudeApiKey?: string;
  claudeApiKeys?: string[];
  claudeBackupApiKeys?: string[];
  deepseekApiKey?: string;
  deepseekApiKeys?: string[];
  deepseekBackupApiKeys?: string[];
  deepseekPreferredModel?: string;
  googleServiceAccountPath?: string;
  customProviders?: CustomProvider[];
  curlProviders?: CurlProvider[];
  defaultModel?: string;
  /** Default model for screen/image understanding (falls back to defaultModel). */
  visionDefaultModel?: string;
  momorApiKey?: string;
  momorApiKeys?: string[];
  momorBackupApiKeys?: string[];
  // STT Provider settings
  sttProvider?:
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
  groqSttApiKey?: string;
  groqSttModel?: string;
  openAiSttApiKey?: string;
  /** Custom OpenAI-compatible STT base URL (e.g. self-hosted Speaches).
   *  Empty / unset → use https://api.openai.com. */
  openAiSttBaseUrl?: string;
  deepgramApiKey?: string;
  elevenLabsApiKey?: string;
  azureApiKey?: string;
  azureRegion?: string;
  ibmWatsonApiKey?: string;
  ibmWatsonRegion?: string;
  sonioxApiKey?: string;
  /** Named STT profiles (multi-provider, like LLM integrations). */
  sttProfiles?: SttProfile[];
  defaultSttProfileId?: string | null;
  sttLanguage?: string;
  aiResponseLanguage?: string;
  // Tavily Search
  tavilyApiKey?: string;
  // Dynamic Model Discovery – preferred models per provider
  geminiPreferredModel?: string;
  groqPreferredModel?: string;
  openaiPreferredModel?: string;
  claudePreferredModel?: string;
  // OpenClaude Local CLI
  openclaudeCliPath?: string;
  openclaudeEnabled?: boolean;
  openclaudeModel?: string;
  // WhisperX Local server
  whisperxUrl?: string;
  whisperxEnabled?: boolean;
  // Free trial state
  trialToken?: string; // server-issued signed token (momor_trial_…)
  trialExpiresAt?: string; // ISO timestamp — local copy for startup check
  trialStartedAt?: string; // ISO timestamp
  trialClaimed?: boolean; // set true on first claim, never cleared — hides start card permanently
}

export class CredentialsManager {
  private static instance: CredentialsManager;
  private credentials: StoredCredentials = {};
  /** In-memory rotation index — resets each app session / meeting start. */
  private keyRotationIndex: Record<string, number> = {};

  private constructor() {
    // Load on construction after app ready
  }

  public static getInstance(): CredentialsManager {
    if (!CredentialsManager.instance) {
      CredentialsManager.instance = new CredentialsManager();
    }
    return CredentialsManager.instance;
  }

  /**
   * Initialize - load credentials from disk
   * Must be called after app.whenReady()
   */
  public init(): void {
    this.loadCredentials();
    console.log("[CredentialsManager] Initialized");
  }

  private activeFromList(
    keys: string[],
    rotationKey?: string,
  ): string | undefined {
    const pool = normalizeApiKeyList(keys);
    if (!pool.length) return undefined;
    const idx = rotationKey ? (this.keyRotationIndex[rotationKey] ?? 0) : 0;
    return pool[Math.min(idx, pool.length - 1)];
  }

  private rotateList(
    rotationKey: string,
    keys: string[],
  ): string | undefined {
    const pool = normalizeApiKeyList(keys);
    const nextIdx = (this.keyRotationIndex[rotationKey] ?? 0) + 1;
    if (nextIdx >= pool.length) return undefined;
    this.keyRotationIndex[rotationKey] = nextIdx;
    console.log(
      `[CredentialsManager] Rotated ${rotationKey} to key #${nextIdx + 1}/${pool.length}`,
    );
    return pool[nextIdx];
  }

  /** @deprecated */
  private activeFromPool(
    primary?: string,
    backups?: string[],
    rotationKey?: string,
  ): string | undefined {
    return this.activeFromList(
      mergeLegacyApiKeys(primary, backups),
      rotationKey,
    );
  }

  /** @deprecated */
  private rotatePool(
    rotationKey: string,
    primary?: string,
    backups?: string[],
  ): string | undefined {
    return this.rotateList(
      rotationKey,
      mergeLegacyApiKeys(primary, backups),
    );
  }

  public resetKeyRotation(scope?: string): void {
    if (!scope) {
      this.keyRotationIndex = {};
      return;
    }
    for (const key of Object.keys(this.keyRotationIndex)) {
      if (key.startsWith(scope)) delete this.keyRotationIndex[key];
    }
  }

  public resetAllKeyRotation(): void {
    this.keyRotationIndex = {};
  }

  public rotateLlmApiKey(provider: LlmProviderId): string | undefined {
    return this.rotateList(`llm:${provider}`, this.getLlmApiKeysList(provider));
  }

  public getLlmApiKeysList(provider: LlmProviderId): string[] {
    switch (provider) {
      case "gemini":
        if (this.credentials.geminiApiKeys?.length) {
          return normalizeApiKeyList(this.credentials.geminiApiKeys);
        }
        return mergeLegacyApiKeys(
          this.credentials.geminiApiKey,
          this.credentials.geminiBackupApiKeys,
        );
      case "groq":
        if (this.credentials.groqApiKeys?.length) {
          return normalizeApiKeyList(this.credentials.groqApiKeys);
        }
        return mergeLegacyApiKeys(
          this.credentials.groqApiKey,
          this.credentials.groqBackupApiKeys,
        );
      case "openai":
        if (this.credentials.openaiApiKeys?.length) {
          return normalizeApiKeyList(this.credentials.openaiApiKeys);
        }
        return mergeLegacyApiKeys(
          this.credentials.openaiApiKey,
          this.credentials.openaiBackupApiKeys,
        );
      case "claude":
        if (this.credentials.claudeApiKeys?.length) {
          return normalizeApiKeyList(this.credentials.claudeApiKeys);
        }
        return mergeLegacyApiKeys(
          this.credentials.claudeApiKey,
          this.credentials.claudeBackupApiKeys,
        );
      case "deepseek":
        if (this.credentials.deepseekApiKeys?.length) {
          return normalizeApiKeyList(this.credentials.deepseekApiKeys);
        }
        return mergeLegacyApiKeys(
          this.credentials.deepseekApiKey,
          this.credentials.deepseekBackupApiKeys,
        );
      case "momor":
        if (this.credentials.momorApiKeys?.length) {
          return normalizeApiKeyList(this.credentials.momorApiKeys);
        }
        return mergeLegacyApiKeys(
          this.credentials.momorApiKey,
          this.credentials.momorBackupApiKeys,
        );
      default:
        return [];
    }
  }

  private syncLegacyLlmFields(provider: LlmProviderId, keys: string[]): void {
    const normalized = normalizeApiKeyList(keys);
    switch (provider) {
      case "gemini":
        this.credentials.geminiApiKeys = normalized;
        this.credentials.geminiApiKey = normalized[0];
        this.credentials.geminiBackupApiKeys = normalized.slice(1);
        break;
      case "groq":
        this.credentials.groqApiKeys = normalized;
        this.credentials.groqApiKey = normalized[0];
        this.credentials.groqBackupApiKeys = normalized.slice(1);
        break;
      case "openai":
        this.credentials.openaiApiKeys = normalized;
        this.credentials.openaiApiKey = normalized[0];
        this.credentials.openaiBackupApiKeys = normalized.slice(1);
        break;
      case "claude":
        this.credentials.claudeApiKeys = normalized;
        this.credentials.claudeApiKey = normalized[0];
        this.credentials.claudeBackupApiKeys = normalized.slice(1);
        break;
      case "deepseek":
        this.credentials.deepseekApiKeys = normalized;
        this.credentials.deepseekApiKey = normalized[0];
        this.credentials.deepseekBackupApiKeys = normalized.slice(1);
        break;
      case "momor":
        this.credentials.momorApiKeys = normalized;
        this.credentials.momorApiKey = normalized[0];
        this.credentials.momorBackupApiKeys = normalized.slice(1);
        break;
    }
  }

  public setLlmApiKeys(provider: LlmProviderId, keys: string[]): void {
    this.syncLegacyLlmFields(provider, keys);
    this.saveCredentials();
  }

  public setLlmBackupApiKeys(
    provider: LlmProviderId,
    keys: string[],
  ): void {
    const primary = this.getLlmApiKeysList(provider)[0];
    this.setLlmApiKeys(
      provider,
      primary ? [primary, ...keys] : keys,
    );
  }

  public getLlmBackupApiKeys(provider: LlmProviderId): string[] {
    const list = this.getLlmApiKeysList(provider);
    return list.slice(1);
  }

  public getMaskedLlmBackupApiKeys(provider: LlmProviderId): string[] {
    return maskApiKeyList(this.getLlmBackupApiKeys(provider));
  }

  public getActiveSttApiKeyForProfile(profile: SttProfile): string | undefined {
    return this.activeFromList(
      getSttProfileApiKeys(profile),
      `stt:${profile.id}`,
    );
  }

  public rotateSttApiKeyForProfile(profileId: string): string | undefined {
    const profile = this.credentials.sttProfiles?.find((p) => p.id === profileId);
    if (!profile) return undefined;
    return this.rotateList(`stt:${profile.id}`, getSttProfileApiKeys(profile));
  }

  public rotateActiveSttApiKey(sessionProfileId?: string | null): string | undefined {
    const profile = this.resolveActiveSttProfile(sessionProfileId);
    if (!profile) return undefined;
    return this.rotateSttApiKeyForProfile(profile.id);
  }

  // =========================================================================
  // Getters
  // =========================================================================

  public getGeminiApiKey(): string | undefined {
    return this.activeFromList(this.getLlmApiKeysList("gemini"), "llm:gemini");
  }

  public getGroqApiKey(): string | undefined {
    return this.activeFromList(this.getLlmApiKeysList("groq"), "llm:groq");
  }

  public getOpenaiApiKey(): string | undefined {
    return this.activeFromList(this.getLlmApiKeysList("openai"), "llm:openai");
  }

  public getClaudeApiKey(): string | undefined {
    return this.activeFromList(this.getLlmApiKeysList("claude"), "llm:claude");
  }

  public getDeepseekApiKey(): string | undefined {
    return this.activeFromList(
      this.getLlmApiKeysList("deepseek"),
      "llm:deepseek",
    );
  }

  public getDeepseekPreferredModel(): string | undefined {
    return this.credentials.deepseekPreferredModel;
  }

  public getGoogleServiceAccountPath(): string | undefined {
    return this.credentials.googleServiceAccountPath;
  }

  public getCustomProviders(): CustomProvider[] {
    return this.credentials.customProviders || [];
  }

  public getSttProfiles(): SttProfile[] {
    this.ensureSttProfiles();
    return [...(this.credentials.sttProfiles ?? [])];
  }

  public getSttProfileById(profileId: string): SttProfile | undefined {
    this.ensureSttProfiles();
    return this.credentials.sttProfiles?.find((p) => p.id === profileId);
  }

  /** Resolve keys to test/use — draft list overrides stored profile keys. */
  public resolveSttApiKeysForProfile(
    profileId: string,
    draftKeys?: string[],
  ): string[] {
    const draft = normalizeApiKeyList(draftKeys ?? []);
    if (draft.length) return draft;
    const profile = this.getSttProfileById(profileId);
    if (!profile) return [];
    return getSttProfileApiKeys(profile);
  }

  /** @deprecated Use resolveSttApiKeysForProfile */
  public resolveSttApiKeyForProfile(
    profileId: string,
    draftKey?: string,
  ): string | undefined {
    const keys = this.resolveSttApiKeysForProfile(
      profileId,
      draftKey?.trim() ? [draftKey.trim()] : undefined,
    );
    return keys[0];
  }

  public getDefaultSttProfileId(): string | null {
    this.ensureSttProfiles();
    return this.credentials.defaultSttProfileId ?? null;
  }

  public setDefaultSttProfileId(id: string | null): void {
    this.ensureSttProfiles();
    this.credentials.defaultSttProfileId = id;
    const profile =
      id && this.credentials.sttProfiles?.find((p) => p.id === id);
    if (profile) syncLegacySttFields(this.credentials, profile);
    this.saveCredentials();
  }

  public resolveActiveSttProfile(
    sessionProfileId?: string | null,
  ): SttProfile | null {
    this.ensureSttProfiles();
    return resolveActiveSttProfile(this.credentials, sessionProfileId);
  }

  public applyActiveSttProfileToLegacy(
    sessionProfileId?: string | null,
  ): SttProfile | null {
    const profile = this.resolveActiveSttProfile(sessionProfileId);
    syncLegacySttFields(this.credentials, profile);
    if (profile?.kind === "local-whisper" && profile.model) {
      const { SettingsManager } = require("./SettingsManager");
      SettingsManager.getInstance().set("localWhisperModel", profile.model);
    }
    return profile;
  }

  /** Keep STT profile.model in sync when user picks a model in the whisper panel. */
  public syncLocalWhisperModelOnProfiles(modelId: string): void {
    this.ensureSttProfiles();
    let changed = false;
    for (const p of this.credentials.sttProfiles ?? []) {
      if (p.kind === "local-whisper" && p.model !== modelId) {
        p.model = modelId;
        changed = true;
      }
    }
    if (changed) this.saveCredentials();
  }

  public upsertSttProfile(profile: SttProfile): void {
    this.ensureSttProfiles();
    if (!this.credentials.sttProfiles) this.credentials.sttProfiles = [];
    const idx = this.credentials.sttProfiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      const prev = this.credentials.sttProfiles[idx];
      let merged: SttProfile = { ...prev, ...profile };
      if (profile.apiKeys !== undefined) {
        merged = applySttProfileApiKeys(merged, profile.apiKeys);
      } else if (profile.apiKey !== undefined || profile.backupApiKeys !== undefined) {
        merged = applySttProfileApiKeys(
          merged,
          mergeLegacyApiKeys(
            profile.apiKey ?? prev.apiKey,
            profile.backupApiKeys ?? prev.backupApiKeys,
          ),
        );
      }
      this.credentials.sttProfiles[idx] = merged;
    } else {
      this.credentials.sttProfiles.push(profile);
    }
    if (!this.credentials.defaultSttProfileId) {
      this.credentials.defaultSttProfileId = profile.id;
    }
    const active = this.resolveActiveSttProfile(null);
    if (active) syncLegacySttFields(this.credentials, active);
    this.saveCredentials();
  }

  public deleteSttProfile(id: string): void {
    this.ensureSttProfiles();
    if (!this.credentials.sttProfiles) return;
    this.credentials.sttProfiles = this.credentials.sttProfiles.filter(
      (p) => p.id !== id,
    );
    if (this.credentials.defaultSttProfileId === id) {
      this.credentials.defaultSttProfileId =
        this.credentials.sttProfiles[0]?.id ?? null;
    }
    const active = this.resolveActiveSttProfile(null);
    syncLegacySttFields(this.credentials, active);
    this.saveCredentials();
  }

  public addSttPreset(kind: SttProfileKind, name?: string): SttProfile {
    this.ensureSttProfiles();
    const existing = this.credentials.sttProfiles!.find((p) => p.kind === kind);
    if (existing) return existing;
    const { STT_PRESET_CATALOG } = require("./sttProfiles");
    const presetLabel =
      STT_PRESET_CATALOG.find((p: { kind: string }) => p.kind === kind)?.name ??
      kind;
    const profile: SttProfile = {
      id: newSttProfileId(),
      name: name ?? presetLabel,
      kind,
      enabled: true,
    };
    this.credentials.sttProfiles!.push(profile);
    this.saveCredentials();
    return profile;
  }

  public getSttProvider(sessionProfileId?: string | null):
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
    | "local-whisper" {
    const resolved = this.resolveActiveSttProfile(sessionProfileId);
    if (resolved) return resolved.kind;
    const provider = this.credentials.sttProvider || "none";
    // Self-heal: if provider is 'none' but a momor key exists, the user is in a
    // broken state (key cleared then re-entered via a path that skipped auto-promote,
    // or credentials restored from backup). Silently restore to 'momor' so STT works.
    if (provider === "none" && this.credentials.momorApiKey) {
      this.credentials.sttProvider = "momor";
      this.saveCredentials();
      console.log(
        "[CredentialsManager] Self-healed sttProvider: none→momor (momor key present)",
      );
      return "momor";
    }
    return provider;
  }

  private getActiveSttKeyByKind(
    kind: SttProfileKind,
    sessionProfileId?: string | null,
  ): string | undefined {
    const profile = this.resolveActiveSttProfile(sessionProfileId);
    if (profile?.kind === kind) {
      return this.getActiveSttApiKeyForProfile(profile);
    }
    return undefined;
  }

  private legacySttKeyForKind(kind: SttProfileKind): string | undefined {
    let key: string | undefined;
    switch (kind) {
      case "groq":
        key = this.credentials.groqSttApiKey;
        break;
      case "openai":
        key = this.credentials.openAiSttApiKey;
        break;
      case "deepgram":
        key = this.credentials.deepgramApiKey;
        break;
      case "elevenlabs":
        key = this.credentials.elevenLabsApiKey;
        break;
      case "azure":
        key = this.credentials.azureApiKey;
        break;
      case "ibmwatson":
        key = this.credentials.ibmWatsonApiKey;
        break;
      case "soniox":
        key = this.credentials.sonioxApiKey;
        break;
      default:
        key = undefined;
    }
    const trimmed = key?.trim();
    if (!trimmed || trimmed.includes("...")) return undefined;
    return trimmed;
  }

  public getSttApiKeyForKind(
    kind: SttProfileKind,
    sessionProfileId?: string | null,
  ): string | undefined {
    return (
      this.getActiveSttKeyByKind(kind, sessionProfileId) ??
      this.legacySttKeyForKind(kind)
    );
  }

  public getDeepgramApiKey(sessionProfileId?: string | null): string | undefined {
    return this.getSttApiKeyForKind("deepgram", sessionProfileId);
  }

  public getGroqSttApiKey(sessionProfileId?: string | null): string | undefined {
    return this.getSttApiKeyForKind("groq", sessionProfileId);
  }

  public getGroqSttModel(): string {
    return this.credentials.groqSttModel || "whisper-large-v3-turbo";
  }

  public getOpenAiSttApiKey(sessionProfileId?: string | null): string | undefined {
    return this.getSttApiKeyForKind("openai", sessionProfileId);
  }

  public getOpenAiSttBaseUrl(): string | undefined {
    return this.credentials.openAiSttBaseUrl;
  }

  public getElevenLabsApiKey(sessionProfileId?: string | null): string | undefined {
    return this.getSttApiKeyForKind("elevenlabs", sessionProfileId);
  }

  public getAzureApiKey(sessionProfileId?: string | null): string | undefined {
    return this.getSttApiKeyForKind("azure", sessionProfileId);
  }

  public getAzureRegion(): string {
    return this.credentials.azureRegion || "eastus";
  }

  public getIbmWatsonApiKey(sessionProfileId?: string | null): string | undefined {
    return this.getSttApiKeyForKind("ibmwatson", sessionProfileId);
  }

  public getIbmWatsonRegion(): string {
    return this.credentials.ibmWatsonRegion || "us-south";
  }

  public getSonioxApiKey(sessionProfileId?: string | null): string | undefined {
    return this.getSttApiKeyForKind("soniox", sessionProfileId);
  }

  public getTavilyApiKey(): string | undefined {
    return this.credentials.tavilyApiKey;
  }

  public getSttLanguage(): string {
    return this.credentials.sttLanguage || "auto";
  }

  public getAiResponseLanguage(): string {
    return this.credentials.aiResponseLanguage || "auto";
  }
  public getDefaultModel(): string {
    return this.credentials.defaultModel || "gemini-3.1-flash-lite-preview";
  }

  public getVisionDefaultModel(): string {
    return (
      this.credentials.visionDefaultModel ||
      this.credentials.defaultModel ||
      "gemini-3.1-flash-lite-preview"
    );
  }

  public getmomorApiKey(): string | undefined {
    return this.activeFromList(this.getLlmApiKeysList("momor"), "llm:momor");
  }

  public getAllCredentials(): StoredCredentials {
    return { ...this.credentials };
  }

  // =========================================================================
  // Vision provider availability — used by the vision-first screen pipeline
  // =========================================================================

  /**
   * True if at least one configured provider is vision-capable.
   * Used by ScreenUnderstandingService to gate vision_only / decide fallback.
   */
  public anyVisionProviderConfigured(): boolean {
    if (this.credentials.momorApiKey) return true; // momor API supports vision
    if (this.credentials.openaiApiKey) return true; // gpt-4o / gpt-5 vision
    if (this.credentials.claudeApiKey) return true; // Claude vision
    if (this.credentials.geminiApiKey) return true; // Gemini vision
    if (this.credentials.groqApiKey) return true; // Groq llama-4-scout vision
    // Custom providers: only count if they have screenshots scope AND multimodal flag
    const custom = this.credentials.customProviders || [];
    if (custom.some((p) => (p as any)?.multimodal === true)) return true;
    return this.anyLocalVisionProviderConfigured();
  }

  /**
   * True if at least one LOCAL vision provider is configured (Ollama vision model,
   * Codex CLI with vision support, or a local-only custom provider).
   * Used by private_vision mode to enforce no cloud-vision calls.
   */
  public anyLocalVisionProviderConfigured(): boolean {
    // Ollama: caller verifies the configured model is vision-capable via modelCapabilities.
    // Here we only assert the runtime is configured — model gating happens in the chain.
    const ollamaBaseUrl = (this.credentials as any).ollamaBaseUrl as
      | string
      | undefined;
    if (ollamaBaseUrl && ollamaBaseUrl.trim().length > 0) return true;
    // Codex CLI is local in normal install — capability is verified by ProviderRouter.
    const codexCliPath = (this.credentials as any).codexCliPath as
      | string
      | undefined;
    if (codexCliPath && codexCliPath.trim().length > 0) return true;
    return false;
  }

  // =========================================================================
  // Setters (auto-save)
  // =========================================================================

  public setGeminiApiKey(key: string): void {
    this.setLlmApiKeys("gemini", key.trim() ? [key.trim()] : []);
    console.log("[CredentialsManager] Gemini API Key updated");
  }

  public setGroqApiKey(key: string): void {
    this.setLlmApiKeys("groq", key.trim() ? [key.trim()] : []);
    console.log("[CredentialsManager] Groq API Key updated");
  }

  public setOpenaiApiKey(key: string): void {
    this.setLlmApiKeys("openai", key.trim() ? [key.trim()] : []);
    console.log("[CredentialsManager] OpenAI API Key updated");
  }

  public setClaudeApiKey(key: string): void {
    this.setLlmApiKeys("claude", key.trim() ? [key.trim()] : []);
    console.log("[CredentialsManager] Claude API Key updated");
  }

  public setDeepseekApiKey(key: string): void {
    this.setLlmApiKeys("deepseek", key.trim() ? [key.trim()] : []);
    console.log("[CredentialsManager] DeepSeek API Key updated");
  }

  public setDeepseekPreferredModel(model: string): void {
    this.credentials.deepseekPreferredModel = model;
    this.saveCredentials();
    console.log(
      `[CredentialsManager] DeepSeek preferred model set to: ${model}`,
    );
  }

  public setGoogleServiceAccountPath(filePath: string): void {
    this.credentials.googleServiceAccountPath = filePath;
    this.saveCredentials();
    console.log("[CredentialsManager] Google Service Account path updated");
  }

  public setSttProvider(
    provider:
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
      | "local-whisper",
  ): void {
    this.ensureSttProfiles();
    const profiles = this.credentials.sttProfiles ?? [];
    let profile = profiles.find((p) => p.kind === provider);
    if (!profile && provider !== "none") {
      profile = {
        id: newSttProfileId(),
        name: provider,
        kind: provider,
        enabled: true,
      };
      profiles.push(profile);
      this.credentials.sttProfiles = profiles;
    }
    if (profile) {
      this.credentials.defaultSttProfileId = profile.id;
      syncLegacySttFields(this.credentials, profile);
    } else {
      this.credentials.sttProvider = provider;
    }
    this.saveCredentials();
    console.log(`[CredentialsManager] STT Provider set to: ${provider}`);
  }

  private ensureSttProfiles(): void {
    migrateSttProfiles(this.credentials);
    if (!this.credentials.sttProfiles?.length) {
      this.credentials.sttProfiles = [];
    }
  }

  public getMaskedSttProfiles() {
    this.ensureSttProfiles();
    return exposeSttProfilesForSettings(
      this.credentials.sttProfiles ?? [],
      this.credentials,
    );
  }

  private migrateApiKeyLists(): void {
    const providers: LlmProviderId[] = [
      "gemini",
      "groq",
      "openai",
      "claude",
      "deepseek",
      "momor",
    ];
    for (const provider of providers) {
      const existing = this.getLlmApiKeysList(provider);
      if (existing.length) {
        this.syncLegacyLlmFields(provider, existing);
      }
    }

    for (const profile of this.credentials.sttProfiles ?? []) {
      const keys = getSttProfileApiKeys(profile);
      if (keys.length) {
        Object.assign(profile, applySttProfileApiKeys(profile, keys));
      }
    }
  }

  public setDeepgramApiKey(key: string): void {
    this.credentials.deepgramApiKey = key;
    this.saveCredentials();
    console.log("[CredentialsManager] Deepgram API Key updated");
  }

  public setGroqSttApiKey(key: string): void {
    this.credentials.groqSttApiKey = key;
    this.saveCredentials();
    console.log("[CredentialsManager] Groq STT API Key updated");
  }

  public setOpenAiSttApiKey(key: string): void {
    this.credentials.openAiSttApiKey = key;
    this.saveCredentials();
    console.log("[CredentialsManager] OpenAI STT API Key updated");
  }

  public setOpenAiSttBaseUrl(url: string): void {
    // Store undefined (not empty string) when clearing, so callers can fall back
    // to the default api.openai.com endpoint with a simple truthiness check.
    const trimmed = url.trim();
    this.credentials.openAiSttBaseUrl = trimmed || undefined;
    this.saveCredentials();
    console.log(
      `[CredentialsManager] OpenAI STT Base URL set to: ${trimmed || "(default)"}`,
    );
  }

  public setGroqSttModel(model: string): void {
    this.credentials.groqSttModel = model;
    this.saveCredentials();
    console.log(`[CredentialsManager] Groq STT Model set to: ${model}`);
  }

  public setElevenLabsApiKey(key: string): void {
    this.credentials.elevenLabsApiKey = key;
    this.saveCredentials();
    console.log("[CredentialsManager] ElevenLabs API Key updated");
  }

  public setAzureApiKey(key: string): void {
    this.credentials.azureApiKey = key;
    this.saveCredentials();
    console.log("[CredentialsManager] Azure API Key updated");
  }

  public setAzureRegion(region: string): void {
    this.credentials.azureRegion = region;
    this.saveCredentials();
    console.log(`[CredentialsManager] Azure Region set to: ${region}`);
  }

  public setIbmWatsonApiKey(key: string): void {
    this.credentials.ibmWatsonApiKey = key;
    this.saveCredentials();
    console.log("[CredentialsManager] IBM Watson API Key updated");
  }

  public setIbmWatsonRegion(region: string): void {
    this.credentials.ibmWatsonRegion = region;
    this.saveCredentials();
    console.log(`[CredentialsManager] IBM Watson Region set to: ${region}`);
  }

  public setSonioxApiKey(key: string): void {
    this.credentials.sonioxApiKey = key;
    this.saveCredentials();
    console.log("[CredentialsManager] Soniox API Key updated");
  }

  public setTavilyApiKey(key: string): void {
    // Store undefined (not empty string) when removing, so hasKey() checks stay consistent
    this.credentials.tavilyApiKey = key.trim() || undefined;
    this.saveCredentials();
    console.log("[CredentialsManager] Tavily API Key updated");
  }

  public setSttLanguage(language: string): void {
    this.credentials.sttLanguage = language;
    this.saveCredentials();
    console.log(`[CredentialsManager] STT Language set to: ${language}`);
  }

  public setAiResponseLanguage(language: string): void {
    this.credentials.aiResponseLanguage = language;
    this.saveCredentials();
    console.log(
      `[CredentialsManager] AI Response Language set to: ${language}`,
    );
  }
  public setDefaultModel(model: string): void {
    this.credentials.defaultModel = model;
    this.saveCredentials();
    console.log(`[CredentialsManager] Default Model set to: ${model}`);
  }

  public setVisionDefaultModel(model: string): void {
    this.credentials.visionDefaultModel = model;
    this.saveCredentials();
    console.log(`[CredentialsManager] Vision Default Model set to: ${model}`);
  }

  public setmomorApiKey(key: string): void {
    const trimmed = key.trim();
    this.credentials.momorApiKey = trimmed || undefined;

    if (trimmed) {
      // Auto-promote momor to default model unless user already chose a non-Gemini/Groq model
      const current = this.credentials.defaultModel || "";
      const isAutoDefault =
        !current ||
        current.startsWith("gemini-") ||
        current.startsWith("llama-") ||
        current.startsWith("mixtral-") ||
        current.startsWith("gemma-") ||
        current === "gemini" ||
        current === "llama";
      if (isAutoDefault) {
        this.credentials.defaultModel = "momor";
        console.log("[CredentialsManager] Auto-set default model to momor");
      }

      // Auto-promote momor STT if still on 'none' or the default Google STT
      if (
        !this.credentials.sttProvider ||
        this.credentials.sttProvider === "none" ||
        this.credentials.sttProvider === "google"
      ) {
        this.credentials.sttProvider = "momor";
        console.log("[CredentialsManager] Auto-set STT provider to momor");
      }
    } else {
      // Key cleared — revert momor-auto-set defaults back to safe fallbacks
      if (this.credentials.defaultModel === "momor") {
        this.credentials.defaultModel = "gemini-3.1-flash-lite-preview";
        console.log(
          "[CredentialsManager] momor key cleared — reset default model to Gemini Flash",
        );
      }
      if (this.credentials.sttProvider === "momor") {
        this.credentials.sttProvider = "none";
        console.log(
          "[CredentialsManager] momor key cleared — reset STT provider to none",
        );
      }
    }

    this.saveCredentials();
    console.log("[CredentialsManager] momor API Key updated");
  }

  public getPreferredModel(
    provider: "gemini" | "groq" | "openai" | "claude",
  ): string | undefined {
    const key = `${provider}PreferredModel` as keyof StoredCredentials;
    return this.credentials[key] as string | undefined;
  }

  public setPreferredModel(
    provider: "gemini" | "groq" | "openai" | "claude",
    modelId: string,
  ): void {
    const key = `${provider}PreferredModel` as keyof StoredCredentials;
    (this.credentials as any)[key] = modelId;
    this.saveCredentials();
    console.log(
      `[CredentialsManager] ${provider} preferred model set to: ${modelId}`,
    );
  }

  public saveCustomProvider(provider: CustomProvider): void {
    if (!this.credentials.customProviders) {
      this.credentials.customProviders = [];
    }
    // Check if exists, update if so
    const index = this.credentials.customProviders.findIndex(
      (p) => p.id === provider.id,
    );
    if (index !== -1) {
      this.credentials.customProviders[index] = provider;
    } else {
      this.credentials.customProviders.push(provider);
    }
    this.saveCredentials();
    console.log(
      `[CredentialsManager] Custom Provider '${provider.name}' saved`,
    );
  }

  public deleteCustomProvider(id: string): void {
    if (!this.credentials.customProviders) return;
    this.credentials.customProviders = this.credentials.customProviders.filter(
      (p) => p.id !== id,
    );
    this.saveCredentials();
    console.log(`[CredentialsManager] Custom Provider '${id}' deleted`);
  }

  public getCurlProviders(): CurlProvider[] {
    return this.credentials.curlProviders || [];
  }

  public saveCurlProvider(provider: CurlProvider): void {
    if (!this.credentials.curlProviders) {
      this.credentials.curlProviders = [];
    }
    const index = this.credentials.curlProviders.findIndex(
      (p) => p.id === provider.id,
    );
    if (index !== -1) {
      this.credentials.curlProviders[index] = provider;
    } else {
      this.credentials.curlProviders.push(provider);
    }
    this.saveCredentials();
    console.log(`[CredentialsManager] Curl Provider '${provider.name}' saved`);
  }

  public deleteCurlProvider(id: string): void {
    if (!this.credentials.curlProviders) return;
    this.credentials.curlProviders = this.credentials.curlProviders.filter(
      (p) => p.id !== id,
    );
    this.saveCredentials();
    console.log(`[CredentialsManager] Curl Provider '${id}' deleted`);
  }

  // ── Free Trial ─────────────────────────────────────────────
  public getTrialToken(): string | undefined {
    return this.credentials.trialToken;
  }

  public getTrialExpiresAt(): string | undefined {
    return this.credentials.trialExpiresAt;
  }

  public getTrialStartedAt(): string | undefined {
    return this.credentials.trialStartedAt;
  }

  public getTrialClaimed(): boolean {
    return this.credentials.trialClaimed === true;
  }

  public setTrialToken(
    token: string,
    expiresAt: string,
    startedAt: string,
  ): void {
    this.credentials.trialToken = token;
    this.credentials.trialExpiresAt = expiresAt;
    this.credentials.trialStartedAt = startedAt;
    this.credentials.trialClaimed = true;
    this.saveCredentials();
    console.log("[CredentialsManager] Trial token stored, expires:", expiresAt);
  }

  public clearTrialToken(): void {
    delete this.credentials.trialToken;
    delete this.credentials.trialExpiresAt;
    delete this.credentials.trialStartedAt;
    // trialClaimed intentionally NOT cleared — keeps start card hidden after token wipe
    this.saveCredentials();
    console.log("[CredentialsManager] Trial token cleared");
  }

  // ── WhisperX Local Server ───────────────────────────────────
  public getWhisperXUrl(): string | undefined {
    return this.credentials.whisperxUrl;
  }

  public setWhisperXUrl(url: string): void {
    this.credentials.whisperxUrl = url;
    this.saveCredentials();
  }

  public isWhisperXEnabled(): boolean {
    return this.credentials.whisperxEnabled ?? false;
  }

  public setWhisperXEnabled(enabled: boolean): void {
    this.credentials.whisperxEnabled = enabled;
    this.saveCredentials();
  }

  // ── OpenClaude Local CLI ────────────────────────────────────
  public getOpenClaudeCliPath(): string | undefined {
    return this.credentials.openclaudeCliPath;
  }

  public setOpenClaudeCliPath(p: string): void {
    this.credentials.openclaudeCliPath = p;
    this.saveCredentials();
  }

  public isOpenClaudeEnabled(): boolean {
    return this.credentials.openclaudeEnabled ?? false;
  }

  public setOpenClaudeEnabled(v: boolean): void {
    this.credentials.openclaudeEnabled = v;
    this.saveCredentials();
  }

  public getOpenClaudeModel(): string | undefined {
    return this.credentials.openclaudeModel;
  }

  public setOpenClaudeModel(m: string): void {
    this.credentials.openclaudeModel = m;
    this.saveCredentials();
  }

  public clearAll(): void {
    this.scrubMemory();
    if (fs.existsSync(CREDENTIALS_PATH)) {
      fs.unlinkSync(CREDENTIALS_PATH);
    }
    const plaintextPath = CREDENTIALS_PATH + ".json";
    if (fs.existsSync(plaintextPath)) {
      fs.unlinkSync(plaintextPath);
    }
    console.log("[CredentialsManager] All credentials cleared");
  }

  /**
   * Scrub all API keys from memory to minimize exposure window.
   * Called on app quit and credential clear.
   */
  public scrubMemory(): void {
    // Overwrite each string field with empty before discarding
    for (const key of Object.keys(
      this.credentials,
    ) as (keyof StoredCredentials)[]) {
      const val = this.credentials[key];
      if (typeof val === "string") {
        (this.credentials as any)[key] = "";
      }
    }
    this.credentials = {};
    console.log("[CredentialsManager] Memory scrubbed");
  }

  // =========================================================================
  // Storage (Encrypted)
  // =========================================================================

  private saveCredentials(): void {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn(
          "[CredentialsManager] Encryption not available; credentials kept in memory only",
        );
        return;
      }

      const data = JSON.stringify(this.credentials);
      const encrypted = safeStorage.encryptString(data);
      const tmpEnc = CREDENTIALS_PATH + ".tmp";
      fs.writeFileSync(tmpEnc, encrypted);
      fs.renameSync(tmpEnc, CREDENTIALS_PATH);
    } catch (error) {
      console.error("[CredentialsManager] Failed to save credentials:", error);
    }
  }

  private applyEnvFallbacks(): void {
    const deepgramFromEnv = process.env.DEEPGRAM_API_KEY?.trim();
    if (!deepgramFromEnv) return;

    let changed = false;

    if (!this.credentials.deepgramApiKey) {
      this.credentials.deepgramApiKey = deepgramFromEnv;
      changed = true;
      console.log(
        "[CredentialsManager] Loaded Deepgram API key from DEEPGRAM_API_KEY",
      );
    }

    if ((this.credentials.sttProvider || "none") === "none") {
      this.credentials.sttProvider = "deepgram";
      changed = true;
      console.log(
        "[CredentialsManager] Auto-set STT provider to deepgram from env",
      );
    }

    if (!this.credentials.sttLanguage) {
      this.credentials.sttLanguage = "auto";
      changed = true;
    }

    if (changed) {
      this.saveCredentials();
    }
  }

  private loadCredentials(): void {
    try {
      // Try encrypted file first
      if (fs.existsSync(CREDENTIALS_PATH)) {
        if (!safeStorage.isEncryptionAvailable()) {
          console.warn(
            "[CredentialsManager] Encryption not available for load",
          );
          return;
        }

        const encrypted = fs.readFileSync(CREDENTIALS_PATH);
        const decrypted = safeStorage.decryptString(encrypted);
        try {
          const parsed = JSON.parse(decrypted);
          if (typeof parsed === "object" && parsed !== null) {
            this.credentials = parsed;
            console.log("[CredentialsManager] Loaded encrypted credentials");
          } else {
            throw new Error("Decrypted credentials is not a valid object");
          }
        } catch (parseError) {
          console.error(
            "[CredentialsManager] Failed to parse decrypted credentials — file may be corrupted. Starting fresh:",
            parseError,
          );
          this.credentials = {};
        }

        // Clean up any leftover plaintext fallback file to eliminate the data leak
        const plaintextPath = CREDENTIALS_PATH + ".json";
        if (fs.existsSync(plaintextPath)) {
          try {
            fs.unlinkSync(plaintextPath);
            console.log(
              "[CredentialsManager] Removed stale plaintext credential file",
            );
          } catch (cleanupErr) {
            console.warn(
              "[CredentialsManager] Could not remove stale plaintext file:",
              cleanupErr,
            );
          }
        }
        this.applyEnvFallbacks();
        this.ensureSttProfiles();
        this.migrateApiKeyLists();
        return;
      }

      const plaintextPath = CREDENTIALS_PATH + ".json";
      if (fs.existsSync(plaintextPath)) {
        try {
          fs.unlinkSync(plaintextPath);
          console.log("[CredentialsManager] Removed plaintext credential file");
        } catch (cleanupErr) {
          console.warn(
            "[CredentialsManager] Could not remove plaintext credential file:",
            cleanupErr,
          );
        }
      }

      console.log("[CredentialsManager] No stored credentials found");
      this.applyEnvFallbacks();
      this.ensureSttProfiles();
    } catch (error) {
      console.error("[CredentialsManager] Failed to load credentials:", error);
      this.credentials = {};
      this.applyEnvFallbacks();
      this.ensureSttProfiles();
    }
  }
}
