import fs from "fs";
import sharp from "sharp";
import { ModelVersionManager } from "./services/ModelVersionManager";
import {
  HARD_SYSTEM_PROMPT,
  UNIVERSAL_SYSTEM_PROMPT,
  UNIVERSAL_ANSWER_PROMPT,
  UNIVERSAL_WHAT_TO_ANSWER_PROMPT,
  UNIVERSAL_RECAP_PROMPT,
  UNIVERSAL_FOLLOWUP_PROMPT,
  UNIVERSAL_FOLLOW_UP_QUESTIONS_PROMPT,
  UNIVERSAL_ASSIST_PROMPT,
  CHAT_MODE_PROMPT,
  CORE_IDENTITY,
} from "./llm/prompts";
import {
  TINY_SYSTEM_PROMPT,
  TINY_ANSWER_PROMPT,
  TINY_WHAT_TO_ANSWER_PROMPT,
  TINY_RECAP_PROMPT,
  TINY_FOLLOWUP_PROMPT,
  TINY_FOLLOW_UP_QUESTIONS_PROMPT,
  TINY_ASSIST_PROMPT,
  TINY_BRAINSTORM_PROMPT,
  TINY_CLARIFY_PROMPT,
  TINY_CODE_HINT_PROMPT,
  TINY_PROMPTS_SET,
} from "./llm/tinyPrompts";
import {
  getModelCapabilities,
  selectPromptTier,
  estimateTokens,
  truncateTranscriptToFit,
  type PromptTier,
  type ModelCapabilities,
} from "./llm/modelCapabilities";
import {
  assertProviderDataScopes,
  type ProviderDataScope,
  type ProviderDataScopePolicy,
} from "./llm/ProviderRouter";
import type { TranscriptTurn } from "./llm/transcriptCleaner";
import curl2Json from "@bany/curl-to-json";
import { CustomProvider, CurlProvider } from "./services/CredentialsManager";
import { exec } from "child_process";
import { promisify } from "util";
import { createProviderRateLimiters } from "./services/RateLimiter";
import {
  CodexCliConfig,
  CodexCliService,
  DEFAULT_CODEX_CLI_CONFIG,
} from "./services/CodexCliService";
import {
  OpenClaudeService,
  OpenClaudeConfig,
  DEFAULT_OPENCLAUDE_CONFIG,
} from "./services/OpenClaudeService";
import { buildOpenClaudeEnv } from "./openclaude/OpenClaudeEnv";
const execAsync = promisify(exec);

interface OllamaResponse {
  response: string;
  done: boolean;
}

// Model constant for Gemini 3 Flash
const GEMINI_FLASH_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_PRO_MODEL = "gemini-3.1-pro-preview";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const OPENAI_MODEL = "gpt-5.4";
const CLAUDE_MODEL = "claude-sonnet-4-6";

// Simple prompt for image analysis (not interview copilot - kept separate)
const IMAGE_ANALYSIS_PROMPT = `Analyze concisely. Be direct. No markdown formatting. Return plain text only.`;

interface OpenClaudeInvocation {
  scopeProvider: string;
  model?: string;
  providerEnv?: Record<string, string>;
}

export class LLMHelper {
  private client: any = null;
  private groqClient: any = null;
  private openaiClient: any = null;
  private claudeClient: any = null;
  private deepseekClient: any = null;
  private apiKey: string | null = null;
  private groqApiKey: string | null = null;
  private openaiApiKey: string | null = null;
  private claudeApiKey: string | null = null;
  private deepseekApiKey: string | null = null;
  private deepseekModel: string = "deepseek-chat";
  private useOllama: boolean = false;
  private ollamaModel: string = "";
  private ollamaUrl: string = "http://127.0.0.1:11434";
  private ollamaStartedByApp: boolean = false;
  private geminiModel: string = GEMINI_FLASH_MODEL;
  private customProvider: CustomProvider | null = null;
  private activeCurlProvider: CurlProvider | null = null;
  private groqFastTextMode: boolean = false;
  private codexCliConfig: CodexCliConfig = DEFAULT_CODEX_CLI_CONFIG;
  private openclaudeConfig: OpenClaudeConfig = DEFAULT_OPENCLAUDE_CONFIG;
  private knowledgeOrchestrator: any = null;
  private negotiationCoachingHandler: ((payload: unknown) => void) | null =
    null;
  private customNotes: string = "";
  private aiResponseLanguage: string = "auto";
  private sttLanguage: string = "english-us";
  private momorKey: string | null = null;

  // Momor API base URL. Empty string = disabled in this build.
  // Set to a real URL to re-enable the Momor API provider.
  private static readonly MOMOR_ENDPOINT = "";

  // Rate limiters per provider to prevent 429 errors on free tiers
  private rateLimiters: ReturnType<typeof createProviderRateLimiters>;

  // Local-only mode: when enabled, cloud providers are blocked
  private isLocalOnlyMode: boolean = false;

  // Self-improving model version manager for vision analysis
  private modelVersionManager: ModelVersionManager;

  private getProviderScopePolicy(): ProviderDataScopePolicy | undefined {
    try {
      const { SettingsManager } = require("./services/SettingsManager");
      return SettingsManager.getInstance().get("providerDataScopes");
    } catch {
      return undefined;
    }
  }

  private scopesForPayload(
    text: string,
    imagePaths?: string[],
    extraScopes: ProviderDataScope[] = [],
  ): ProviderDataScope[] {
    const scopes = new Set<ProviderDataScope>(extraScopes);
    if (text.trim().length > 0) scopes.add("transcript");
    if (imagePaths?.length) scopes.add("screenshots");
    return [...scopes];
  }

  private assertOutboundScopes(
    provider: string,
    text: string,
    imagePaths?: string[],
    extraScopes: ProviderDataScope[] = [],
  ): void {
    assertProviderDataScopes(
      provider,
      this.scopesForPayload(text, imagePaths, extraScopes),
      this.getProviderScopePolicy(),
    );
  }

  constructor(
    apiKey?: string,
    useOllama: boolean = false,
    ollamaModel?: string,
    ollamaUrl?: string,
    groqApiKey?: string,
    openaiApiKey?: string,
    claudeApiKey?: string,
  ) {
    this.useOllama = useOllama;

    // Initialize rate limiters
    this.rateLimiters = createProviderRateLimiters();

    // Initialize model version manager
    this.modelVersionManager = new ModelVersionManager();

    if (groqApiKey) {
      this.groqApiKey = groqApiKey;
      console.log(
        `[LLMHelper] Groq key configured for OpenClaude routing: ${GROQ_MODEL}`,
      );
    }

    if (openaiApiKey) {
      this.openaiApiKey = openaiApiKey;
      console.log(
        `[LLMHelper] OpenAI key configured for OpenClaude routing: ${OPENAI_MODEL}`,
      );
    }

    if (claudeApiKey) {
      this.claudeApiKey = claudeApiKey;
      console.log(
        `[LLMHelper] Claude key configured for OpenClaude routing: ${CLAUDE_MODEL}`,
      );
    }

    if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://127.0.0.1:11434";
      this.ollamaModel = ollamaModel || "";
      console.log(
        `[LLMHelper] Using Ollama with model: ${this.ollamaModel || "(auto-detect)"}`,
      );

      // Auto-detect first installed model when none specified.
      this.initializeOllamaModel();
    } else if (apiKey) {
      this.apiKey = apiKey;
      console.log(
        `[LLMHelper] Gemini key configured for OpenClaude routing: ${this.geminiModel}`,
      );
    } else {
      console.warn(
        "[LLMHelper] No API key provided. Client will be uninitialized until key is set.",
      );
    }
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    console.log("[LLMHelper] Gemini API Key updated.");
  }

  // Thinking-mode models burn num_predict in <think> blocks unless `think:false` is sent.
  private isThinkingModel(modelId: string): boolean {
    if (!modelId) return false;
    return (
      /^qwen3/i.test(modelId) ||
      /qwq/i.test(modelId) ||
      /deepseek-r1/i.test(modelId) ||
      /(^|[^a-z])o1([^a-z]|$)/i.test(modelId)
    );
  }

  public setGroqApiKey(apiKey: string) {
    this.groqApiKey = apiKey;
    console.log("[LLMHelper] Groq API Key updated.");
  }

  public setOpenaiApiKey(apiKey: string) {
    this.openaiApiKey = apiKey;
    console.log("[LLMHelper] OpenAI API Key updated.");
  }

  public setClaudeApiKey(apiKey: string) {
    this.claudeApiKey = apiKey;
    console.log("[LLMHelper] Claude API Key updated.");
  }

  public initDeepseek(apiKey: string, model?: string): void {
    this.deepseekApiKey = apiKey;
    if (model) this.deepseekModel = model;
    console.log(
      `[LLMHelper] DeepSeek initialized with model: ${this.deepseekModel}`,
    );
  }


  public setmomorKey(key: string | null): void {
    this.momorKey = key || null;
    console.log(`[LLMHelper] momor key ${key ? "set" : "cleared"}`);
  }

  /**
   * Enable or disable local-only mode.
   * When enabled, cloud providers (Gemini, OpenAI, Claude, Groq) will be blocked.
   * Only local providers (Ollama, custom) can be used.
   */
  public setLocalOnlyMode(enabled: boolean): void {
    this.isLocalOnlyMode = enabled;
    console.log(
      `[LLMHelper] Local-only mode ${enabled ? "enabled" : "disabled"}`,
    );
  }

  public isLocalOnly(): boolean {
    return this.isLocalOnlyMode;
  }


  /**
   * Initialize the self-improving model version manager.
   * Should be called after all API keys are configured.
   * Triggers initial model discovery and starts background scheduler.
   */
  public async initModelVersionManager(): Promise<void> {
    this.modelVersionManager.setApiKeys({
      openai: this.openaiApiKey,
      gemini: this.apiKey,
      claude: this.claudeApiKey,
      groq: this.groqApiKey,
    });
    await this.modelVersionManager.initialize();
    console.log(this.modelVersionManager.getSummary());
    // Register this instance for VisionProviderRegistry (vision-first screen pipeline).
    // Registry calls a global accessor instead of constructing its own LLMHelper, so
    // there is exactly one live helper per Electron process with the user's keys/state.
    try {
      (global as any).__momorGetLLMHelper = () => this;
    } catch {
      // global isn't writable in some test contexts; ignored.
    }
  }

  // Vision invocation surface (Phase 3 / VisionProviderRegistry).
  //
  // These thin wrappers expose the existing provider implementations to the
  // vision-first fallback chain. The underlying methods are private to avoid
  // accidental misuse from other call sites; the vision pipeline goes through
  // these named entry points so the surface stays auditable.

  public async runVisionRequest(
    providerId:
      | "momor"
      | "openai"
      | "claude"
      | "gemini_flash"
      | "gemini_pro"
      | "groq_scout"
      | "custom",
    userPrompt: string,
    systemPrompt: string,
    imagePath: string,
  ): Promise<string> {
    const invocation = this.resolveOpenClaudeInvocationForProviderId(providerId);
    return this.runOpenClaudeTurn(
      userPrompt,
      systemPrompt,
      [imagePath],
      "plain",
      invocation,
    );
  }

  /**
   * Run a vision request using the configured vision model id from Integrations.
   * Keeps screen/image understanding independent from the chat default model.
   */
  public async runVisionWithModel(
    modelId: string,
    userPrompt: string,
    systemPrompt: string,
    imagePath: string,
  ): Promise<string> {
    const id = (modelId || "").trim();
    if (!id) throw new Error("Vision model id is required");
    if (this.isCodexCliModel(id)) {
      throw new Error("Codex CLI vision is not supported yet");
    }

    const invocation = this.resolveOpenClaudeInvocationForModelId(id);
    return this.runOpenClaudeTurn(
      userPrompt,
      systemPrompt,
      [imagePath],
      "plain",
      invocation,
    );
  }

  /**
   * Read-only accessor for the active custom provider - used by VisionProviderRegistry
   * to decide whether the provider is configured and whether multimodal is enabled.
   */
  public getActiveCustomProvider(): CustomProvider | null {
    return this.customProvider;
  }

  /**
   * Scrub all API keys from memory to minimize exposure window.
   * Called on app quit.
   */
  public scrubKeys(): void {
    this.apiKey = null;
    this.groqApiKey = null;
    this.openaiApiKey = null;
    this.claudeApiKey = null;
    this.deepseekApiKey = null;
    this.momorKey = null;
    this.client = null;
    this.groqClient = null;
    this.openaiClient = null;
    this.claudeClient = null;
    this.deepseekClient = null;
    // Destroy rate limiters
    if (this.rateLimiters) {
      Object.values(this.rateLimiters).forEach((rl) => rl.destroy());
    }
    // Stop model version manager background scheduler
    this.modelVersionManager.stopScheduler();
    console.log("[LLMHelper] Keys scrubbed from memory");
  }

  public setGroqFastTextMode(enabled: boolean) {
    this.groqFastTextMode = enabled;
    console.log(`[LLMHelper] Groq Fast Text Mode: ${enabled}`);
  }

  public getGroqFastTextMode(): boolean {
    return this.groqFastTextMode;
  }

  public setCodexCliConfig(config: Partial<CodexCliConfig>) {
    this.codexCliConfig = CodexCliService.normalizeConfig(config);
    console.log(
      `[LLMHelper] Codex CLI ${this.codexCliConfig.enabled ? "enabled" : "disabled"} with model: ${this.codexCliConfig.model}`,
    );
  }

  public getCodexCliConfig(): CodexCliConfig {
    return this.codexCliConfig;
  }

  public setOpenClaudeConfig(config: Partial<OpenClaudeConfig>): void {
    this.openclaudeConfig = { ...this.openclaudeConfig, ...config };
    console.log(
      `[LLMHelper] OpenClaude config updated: enabled=${this.openclaudeConfig.enabled}`,
    );
  }

  public prepareOpenClaudeAgentTurn(
    modelId: string | undefined,
    message: string,
    imagePaths?: string[],
  ): OpenClaudeInvocation {
    const invocation =
      typeof modelId === "string" && modelId.trim()
        ? this.resolveOpenClaudeInvocationForModelId(modelId)
        : this.resolveOpenClaudeInvocation();

    this.assertOutboundScopes(
      invocation.scopeProvider,
      message,
      imagePaths,
    );

    return invocation;
  }

  public async recoverExplicitLocalPathReply(
    message: string,
    preloadedFileContext: string,
    invocationOverride: OpenClaudeInvocation,
    imagePaths?: string[],
  ): Promise<string> {
    const groundedSystemPrompt = this.injectLanguageInstruction(
      [
        CORE_IDENTITY,
        "You are momor, a helpful AI assistant developed by ompo-dev.",
        "The host already verified and read the local file references for this turn.",
        "The verified local evidence block below is authoritative.",
        "Answer directly from that grounded local context.",
        "Do not say you lack access, do not ask the user to paste the file, and do not mention generic permission limits unless the evidence itself says the read failed.",
      ].join("\n\n"),
    );

    const groundedPrompt = [
      "<verified-local-evidence>",
      preloadedFileContext,
      "</verified-local-evidence>",
      "",
      "USER QUESTION:",
      message,
    ].join("\n");

    return this.runOpenClaudeTurn(
      groundedPrompt,
      groundedSystemPrompt,
      imagePaths,
      "plain",
      invocationOverride,
    );
  }

  private async runOpenClaudeTurn(
    message: string,
    systemPrompt?: string,
    imagePaths?: string[],
    toolMode: "plain" | "agentic" = "plain",
    invocationOverride?: OpenClaudeInvocation,
  ): Promise<string> {
    let fullResponse = "";
    for await (const chunk of this.streamWithOpenClaude(
      message,
      systemPrompt,
      imagePaths,
      toolMode,
      invocationOverride,
    )) {
      fullResponse += chunk;
    }
    return fullResponse;
  }

  private normalizeOpenAiCompatBaseUrl(rawUrl?: string): string | undefined {
    if (!rawUrl || /\{\{[^}]+\}\}/.test(rawUrl)) return undefined;
    try {
      const parsed = new URL(rawUrl);
      let pathname = parsed.pathname.replace(/\/+$/, "");
      pathname = pathname
        .replace(/\/chat\/completions$/i, "")
        .replace(/\/responses$/i, "")
        .replace(/\/completions$/i, "");
      parsed.pathname = pathname || "/";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().replace(/\/$/, "");
    } catch {
      return undefined;
    }
  }

  private extractOpenClaudeCurlConfig(curlCommand: string): {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    authHeader?: string;
    authHeaderValue?: string;
    authScheme?: string;
  } {
    try {
      const requestConfig = curl2Json(curlCommand);
      const baseUrl = this.normalizeOpenAiCompatBaseUrl(requestConfig.url);
      const data =
        requestConfig.data && typeof requestConfig.data === "object"
          ? requestConfig.data
          : {};
      const model =
        typeof data.model === "string" && !/\{\{[^}]+\}\}/.test(data.model)
          ? data.model
          : undefined;

      let apiKey: string | undefined;
      let authHeader: string | undefined;
      let authHeaderValue: string | undefined;
      let authScheme: string | undefined;

      const headers =
        requestConfig.header && typeof requestConfig.header === "object"
          ? Object.entries(requestConfig.header)
          : [];

      for (const [rawName, rawValue] of headers) {
        if (typeof rawValue !== "string") continue;
        const headerName = rawName.trim();
        const headerValue = rawValue.trim();
        if (!headerName || !headerValue || /\{\{[^}]+\}\}/.test(headerValue)) {
          continue;
        }

        if (/^authorization$/i.test(headerName)) {
          const match = headerValue.match(/^(\S+)\s+(.+)$/);
          if (match) {
            authScheme = match[1];
            apiKey = match[2];
            if (!/^bearer$/i.test(authScheme)) {
              authHeader = headerName;
              authHeaderValue = match[2];
            }
          } else {
            authHeader = headerName;
            authHeaderValue = headerValue;
          }
          continue;
        }

        if (/^(x-api-key|api-key)$/i.test(headerName)) {
          apiKey = headerValue;
          authHeader = headerName;
          authHeaderValue = headerValue;
          continue;
        }

        if (!authHeader) {
          authHeader = headerName;
          authHeaderValue = headerValue;
        }
      }

      return {
        apiKey,
        baseUrl,
        model,
        authHeader,
        authHeaderValue,
        authScheme,
      };
    } catch {
      return {};
    }
  }

  private resolveOpenClaudeInvocation(): OpenClaudeInvocation {
    const { CredentialsManager } = require("./services/CredentialsManager");
    const cm = CredentialsManager.getInstance();

    if (this.useOllama) {
      return {
        scopeProvider: "ollama",
        model: this.ollamaModel || undefined,
        providerEnv: buildOpenClaudeEnv({
          provider: "ollama",
          model: this.ollamaModel || undefined,
        }),
      };
    }

    if (this.customProvider) {
      const parsed = this.extractOpenClaudeCurlConfig(
        this.customProvider.curlCommand,
      );
      const shouldRouteCustom = Boolean(
        parsed.baseUrl || parsed.apiKey || parsed.authHeader,
      );
      return {
        scopeProvider: "custom_provider",
        model: parsed.model,
        providerEnv: shouldRouteCustom
          ? buildOpenClaudeEnv({ provider: "custom", ...parsed })
          : undefined,
      };
    }

    if (this.activeCurlProvider) {
      const parsed = this.extractOpenClaudeCurlConfig(
        this.activeCurlProvider.curlCommand,
      );
      const shouldRouteCustom = Boolean(
        parsed.baseUrl || parsed.apiKey || parsed.authHeader,
      );
      return {
        scopeProvider: "custom_provider",
        model: parsed.model,
        providerEnv: shouldRouteCustom
          ? buildOpenClaudeEnv({ provider: "custom", ...parsed })
          : undefined,
      };
    }

    if (this.isClaudeModel(this.currentModelId)) {
      const apiKey = this.claudeApiKey ?? cm.getClaudeApiKey();
      return {
        scopeProvider: "claude",
        model: this.currentModelId || undefined,
        providerEnv: apiKey
          ? buildOpenClaudeEnv({
              provider: "anthropic",
              apiKey,
              model: this.currentModelId || undefined,
            })
          : undefined,
      };
    }

    if (this.isOpenAiModel(this.currentModelId)) {
      const apiKey = this.openaiApiKey ?? cm.getOpenaiApiKey();
      return {
        scopeProvider: "openai",
        model: this.currentModelId || undefined,
        providerEnv: apiKey
          ? buildOpenClaudeEnv({
              provider: "openai",
              apiKey,
              model: this.currentModelId || undefined,
            })
          : undefined,
      };
    }

    if (this.isDeepSeekModel(this.currentModelId)) {
      const apiKey = this.deepseekApiKey ?? cm.getDeepseekApiKey();
      const model =
        this.currentModelId === "deepseek"
          ? this.deepseekModel
          : this.currentModelId || undefined;
      return {
        scopeProvider: "deepseek",
        model,
        providerEnv: apiKey
          ? buildOpenClaudeEnv({
              provider: "deepseek",
              apiKey,
              model,
            })
          : undefined,
      };
    }

    if (this.isGroqModel(this.currentModelId)) {
      const apiKey = this.groqApiKey ?? cm.getGroqApiKey();
      return {
        scopeProvider: "groq",
        model: this.currentModelId || undefined,
        providerEnv: apiKey
          ? buildOpenClaudeEnv({
              provider: "groq",
              apiKey,
              model: this.currentModelId || undefined,
            })
          : undefined,
      };
    }

    if (this.isGeminiModel(this.currentModelId)) {
      const apiKey = this.apiKey ?? cm.getGeminiApiKey();
      return {
        scopeProvider: "gemini",
        model: this.currentModelId || undefined,
        providerEnv: apiKey
          ? buildOpenClaudeEnv({
              provider: "gemini",
              apiKey,
              model: this.currentModelId || undefined,
            })
          : undefined,
      };
    }

    return {
      scopeProvider: "openclaude",
      model: this.openclaudeConfig.model || undefined,
    };
  }

  private resolveStoredOllamaBaseUrl(): string | undefined {
    try {
      const { CredentialsManager } = require("./services/CredentialsManager");
      const raw = (CredentialsManager.getInstance().getAllCredentials() as any)
        ?.ollamaBaseUrl;
      return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
    } catch {
      return undefined;
    }
  }

  private resolveOpenClaudeInvocationForCustomProvider(
    provider: CustomProvider | CurlProvider,
  ): OpenClaudeInvocation {
    const parsed = this.extractOpenClaudeCurlConfig(provider.curlCommand);
    const providerEnv =
      parsed.baseUrl || parsed.apiKey || parsed.authHeader
        ? buildOpenClaudeEnv({ provider: "custom", ...parsed })
        : undefined;

    return {
      scopeProvider: "custom_provider",
      model: parsed.model,
      providerEnv,
    };
  }

  private resolveOpenClaudeInvocationForModelId(modelId: string): OpenClaudeInvocation {
    const id = (modelId || "").trim();
    if (!id) return this.resolveOpenClaudeInvocation();

    const { CredentialsManager } = require("./services/CredentialsManager");
    const cm = CredentialsManager.getInstance();

    if (id.startsWith("ollama-")) {
      const model = id.replace(/^ollama-/, "");
      return {
        scopeProvider: "ollama",
        model,
        providerEnv: buildOpenClaudeEnv({
          provider: "ollama",
          model,
          baseUrl: this.resolveStoredOllamaBaseUrl(),
        }),
      };
    }

    if (this.isOpenAiModel(id)) {
      return {
        scopeProvider: "openai",
        model: id,
        providerEnv: buildOpenClaudeEnv({
          provider: "openai",
          apiKey: cm.getOpenaiApiKey(),
          model: id,
        }),
      };
    }

    if (this.isClaudeModel(id)) {
      return {
        scopeProvider: "claude",
        model: id,
        providerEnv: buildOpenClaudeEnv({
          provider: "anthropic",
          apiKey: cm.getClaudeApiKey(),
          model: id,
        }),
      };
    }

    if (this.isGeminiModel(id)) {
      return {
        scopeProvider: "gemini",
        model: id,
        providerEnv: buildOpenClaudeEnv({
          provider: "gemini",
          apiKey: cm.getGeminiApiKey(),
          model: id,
        }),
      };
    }

    if (this.isGroqModel(id)) {
      return {
        scopeProvider: "groq",
        model: id,
        providerEnv: buildOpenClaudeEnv({
          provider: "groq",
          apiKey: cm.getGroqApiKey(),
          model: id,
        }),
      };
    }

    if (this.isDeepSeekModel(id)) {
      return {
        scopeProvider: "deepseek",
        model: id,
        providerEnv: buildOpenClaudeEnv({
          provider: "deepseek",
          apiKey: cm.getDeepseekApiKey(),
          model: id,
        }),
      };
    }

    const customProviders = [
      ...(cm.getCurlProviders() || []),
      ...(cm.getCustomProviders() || []),
    ];
    const custom = customProviders.find((provider: any) => provider.id === id);
    if (custom?.curlCommand) {
      return this.resolveOpenClaudeInvocationForCustomProvider(custom);
    }

    return this.resolveOpenClaudeInvocation();
  }

  private resolveOpenClaudeInvocationForProviderId(providerId: string): OpenClaudeInvocation {
    const { CredentialsManager } = require("./services/CredentialsManager");
    const cm = CredentialsManager.getInstance();

    switch (providerId) {
      case "openai":
        return this.resolveOpenClaudeInvocationForModelId("gpt-4o");
      case "claude":
        return this.resolveOpenClaudeInvocationForModelId("claude-sonnet-4-6");
      case "gemini_flash":
        return this.resolveOpenClaudeInvocationForModelId("gemini-3.1-flash-lite-preview");
      case "gemini_pro":
        return this.resolveOpenClaudeInvocationForModelId("gemini-3.1-pro-preview");
      case "groq_scout":
        return this.resolveOpenClaudeInvocationForModelId(
          "meta-llama/llama-4-scout-17b-16e-instruct",
        );
      case "custom": {
        const provider = this.customProvider ?? this.activeCurlProvider;
        if (!provider) throw new Error("No custom provider configured");
        return this.resolveOpenClaudeInvocationForCustomProvider(provider);
      }
      case "ollama":
        return {
          scopeProvider: "ollama",
          model: this.ollamaModel || undefined,
          providerEnv: buildOpenClaudeEnv({
            provider: "ollama",
            model: this.ollamaModel || undefined,
            baseUrl: this.resolveStoredOllamaBaseUrl(),
          }),
        };
      case "momor":
      case "openclaude":
        return {
          scopeProvider: "openclaude",
          model: this.openclaudeConfig.model || undefined,
        };
      default:
        if (providerId.startsWith("ollama-")) {
          return this.resolveOpenClaudeInvocationForModelId(providerId);
        }
        return this.resolveOpenClaudeInvocation();
    }
  }

  public getAiResponseLanguage(): string {
    return this.aiResponseLanguage;
  }

  // --- Model Type Checkers ---
  private isOpenAiModel(modelId: string): boolean {
    return (
      modelId.startsWith("gpt-") ||
      modelId.startsWith("o1-") ||
      modelId.startsWith("o3-") ||
      modelId.includes("openai")
    );
  }

  private isClaudeModel(modelId: string): boolean {
    return modelId.startsWith("claude-");
  }

  private isGroqModel(modelId: string): boolean {
    return (
      modelId.startsWith("llama-") ||
      modelId.startsWith("mixtral-") ||
      modelId.startsWith("gemma-") ||
      modelId.startsWith("meta-llama/") ||
      modelId.startsWith("qwen/") ||
      modelId.startsWith("qwen-")
    );
  }

  private isGeminiModel(modelId: string): boolean {
    return modelId.startsWith("gemini-") || modelId.startsWith("models/");
  }

  private isDeepSeekModel(modelId: string): boolean {
    return (
      modelId === "deepseek" ||
      modelId.startsWith("deepseek-") ||
      modelId.includes("deepseek")
    );
  }

  private isCodexCliModel(modelId: string): boolean {
    return modelId === "codex-cli" || modelId.startsWith("codex-cli:");
  }

  // Execution mode marker: "agent-cli:<provider>" selects a CLI agent
  // (claude / openclaude / opencode / codex) as the brain for this turn.
  private isAgentCliModel(modelId: string): boolean {
    return modelId === "agent-cli" || modelId.startsWith("agent-cli:");
  }

  /**
   * Route a turn through the agent CLI orchestrator and surface its text
   * stream. Tool calls / file changes are intentionally not threaded through
   * the generic token stream - the Agent Console (meeting overlay) consumes the
   * richer event channel directly. This path exists so a CLI agent can be the
   * user's selected model in the normal assist/chat flow too.
   */
  private async *streamWithOpenClaude(
    message: string,
    systemPrompt?: string,
    imagePaths?: string[],
    toolMode: "plain" | "agentic" = "agentic",
    invocationOverride?: OpenClaudeInvocation,
  ): AsyncGenerator<string, void, unknown> {
    const invocation = invocationOverride ?? this.resolveOpenClaudeInvocation();

    // Fail-closed data-scope enforcement: openclaude still forwards the turn
    // to the selected backend provider, so the same outbound-scope gate applies
    // even though the transport is now centralized in one CLI.
    this.assertOutboundScopes(
      invocation.scopeProvider,
      message,
      imagePaths,
    );

    try {
      const { AgentOrchestrator } = require("./services/agent/AgentOrchestrator");
      const { SettingsManager } = require("./services/SettingsManager");
      const settings = (() => {
        try {
          return SettingsManager.getInstance().get("agentCli") ?? {};
        } catch {
          return {};
        }
      })();

      const stream = AgentOrchestrator.getInstance().run(
        {
          prompt: message,
          systemPrompt,
          provider: "openclaude",
          model: invocation.model,
          imagePaths,
          providerEnv: invocation.providerEnv,
          toolMode,
        },
        settings,
      );

      for await (const ev of stream) {
        if (ev.type === "token" && ev.text) yield ev.text;
        else if (ev.type === "tool_call")
          this.broadcastAgentEvent("agent-tool-call", {
            toolId: ev.toolId,
            name: ev.toolName,
            args: ev.toolArgs,
          });
        else if (ev.type === "tool_result")
          this.broadcastAgentEvent("agent-tool-result", {
            toolId: ev.toolId,
            result: ev.toolResult,
            isError: ev.toolIsError,
          });
        else if (ev.type === "error" && ev.error) throw new Error(ev.error);
      }
    } catch (err: any) {
      throw new Error(`Local agent failed: ${err?.message ?? "unknown error"}`);
    }
  }

  /** Enabled skills as a system-prompt block (shared by every provider). */
  private getEnabledSkillsBlock(): string {
    try {
      const { DatabaseManager } = require("./db/DatabaseManager");
      const skills = DatabaseManager.getInstance().getEnabledSkills();
      if (!skills.length) return "";
      const parts = skills.map(
        (s: any) =>
          `## ${s.name}\n${s.description ? s.description + "\n\n" : ""}${s.content}`,
      );
      return (
        "# Available skills\n" +
        "When a request matches a skill's description, follow that skill's instructions.\n\n" +
        parts.join("\n\n")
      );
    } catch {
      return "";
    }
  }

  /** Broadcast an agent tool event to all windows (overlay surfaces it as a chip). */
  private broadcastAgentEvent(channel: string, payload: any): void {
    try {
      const { BrowserWindow } = require("electron");
      for (const w of BrowserWindow.getAllWindows()) {
        try {
          if (!w.isDestroyed()) w.webContents.send(channel, payload);
        } catch {
          /* noop */
        }
      }
    } catch {
      /* noop */
    }
  }
  // ---------------------------

  private currentModelId: string = GEMINI_FLASH_MODEL;


  public setModel(
    modelId: string,
    customProviders: (CustomProvider | CurlProvider)[] = [],
  ) {
    // Map UI short codes to internal Model IDs
    let targetModelId = modelId;
    if (modelId === "gemini") targetModelId = GEMINI_FLASH_MODEL;
    if (modelId === "gemini-pro") targetModelId = GEMINI_PRO_MODEL;
    if (modelId === "claude") targetModelId = CLAUDE_MODEL;
    if (modelId === "llama") targetModelId = GROQ_MODEL;

    if (targetModelId.startsWith("ollama-")) {
      this.useOllama = true;
      this.ollamaModel = targetModelId.replace("ollama-", "");
      this.customProvider = null;
      this.activeCurlProvider = null;
      console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaModel}`);
      return;
    }

    const custom = customProviders.find((p) => p.id === targetModelId);
    if (custom) {
      this.useOllama = false;
      this.customProvider = custom;
      this.activeCurlProvider = null;
      console.log(`[LLMHelper] Switched to Custom Provider: ${custom.name}`);
      return;
    }

    // Standard Cloud Models
    this.useOllama = false;
    this.customProvider = null;
    this.activeCurlProvider = null;
    this.currentModelId = targetModelId;

    // Update specific model props if needed
    if (targetModelId === GEMINI_PRO_MODEL) this.geminiModel = GEMINI_PRO_MODEL;
    if (targetModelId === GEMINI_FLASH_MODEL)
      this.geminiModel = GEMINI_FLASH_MODEL;

    console.log(`[LLMHelper] Switched to Model: ${targetModelId}`);
  }

  private buildCodexCliPrompt(
    userContent: string,
    systemPrompt?: string,
  ): string {
    return [systemPrompt, userContent].filter(Boolean).join("\n\n");
  }

  private getSelectedCodexCliModel(fastMode: boolean): string {
    if (fastMode) return this.codexCliConfig.fastModel;
    if (this.currentModelId.startsWith("codex-cli:")) {
      return (
        this.currentModelId.slice("codex-cli:".length) ||
        this.codexCliConfig.model
      );
    }
    return this.codexCliConfig.model;
  }

  private async generateWithCodexCli(
    userContent: string,
    systemPrompt?: string,
    fastMode = false,
    imagePaths?: string[],
    signal?: AbortSignal,
  ): Promise<string> {
    if (!this.codexCliConfig.enabled)
      throw new Error("Codex CLI transport is disabled.");
    const model = this.getSelectedCodexCliModel(fastMode);
    return CodexCliService.run(this.codexCliConfig.path, {
      prompt: this.buildCodexCliPrompt(userContent, systemPrompt),
      model,
      timeoutMs: this.codexCliConfig.timeoutMs,
      imagePaths,
      sandboxMode: this.codexCliConfig.sandboxMode,
      signal,
    });
  }

  private async *streamWithCodexCli(
    userContent: string,
    systemPrompt?: string,
    fastMode = false,
    imagePaths?: string[],
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    if (!this.codexCliConfig.enabled)
      throw new Error("Codex CLI transport is disabled.");
    const model = this.getSelectedCodexCliModel(fastMode);
    yield* CodexCliService.stream(this.codexCliConfig.path, {
      prompt: this.buildCodexCliPrompt(userContent, systemPrompt),
      model,
      timeoutMs: this.codexCliConfig.timeoutMs,
      imagePaths,
      sandboxMode: this.codexCliConfig.sandboxMode,
      signal,
    });
  }

  public switchToCurl(provider: CurlProvider) {
    this.useOllama = false;
    this.customProvider = null;
    this.activeCurlProvider = provider;
    console.log(`[LLMHelper] Switched to cURL provider: ${provider.name}`);
  }

  // Trim a context blob to fit within the active model's prompt budget.
  // Cloud tier always returns text unchanged. Local tiers drop oldest lines first.
  public fitContextForCurrentModel(
    text: string,
    reservedOutputTokens?: number,
  ): string {
    if (!text) return text;
    const modelId = this.useOllama ? this.ollamaModel : this.currentModelId;
    const caps = getModelCapabilities(modelId, this.useOllama);
    if (caps.maxContextTokens >= 100_000) return text;
    const reserved = reservedOutputTokens ?? 2000;
    const cap = Math.floor(caps.maxContextTokens * 0.8);
    const totalFor = (s: string) =>
      caps.promptBudgetTokens + reserved + estimateTokens(s);
    if (totalFor(text) <= cap) return text;
    const lines = text.split("\n");
    while (lines.length > 1 && totalFor(lines.join("\n")) > cap) {
      lines.shift();
    }
    return lines.join("\n");
  }

  // Trim a transcript array to fit within the active model's prompt budget.
  public fitTranscriptForCurrentModel(
    turns: TranscriptTurn[],
  ): TranscriptTurn[] {
    const modelId = this.useOllama ? this.ollamaModel : this.currentModelId;
    const caps = getModelCapabilities(modelId, this.useOllama);
    const budget = Math.max(
      0,
      Math.floor(caps.maxContextTokens * 0.8) -
        caps.promptBudgetTokens -
        caps.outputBudgetTokens,
    );
    return truncateTranscriptToFit(turns, budget);
  }

  private cleanJsonResponse(text: string): string {
    // Remove markdown code block syntax if present
    text = text.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "");
    // Remove any leading/trailing whitespace
    text = text.trim();
    return text;
  }

  private async callOllama(
    prompt: string,
    imagePath?: string,
    systemPrompt?: string,
  ): Promise<string> {
    try {
      let images: string[] | undefined;
      if (imagePath) {
        try {
          const imageData = await fs.promises.readFile(imagePath);
          images = [imageData.toString("base64")];
        } catch (e) {
          console.warn(
            "[LLMHelper] callOllama: failed to read image, sending text only:",
            e,
          );
        }
      }

      const sys = systemPrompt ?? TINY_SYSTEM_PROMPT;
      // Per-request hard guard: trim userContent (never sys) until total fits the model's max ctx.
      let userContent = prompt;
      const maxCtx = getModelCapabilities(
        this.ollamaModel,
        true,
      ).maxContextTokens;
      let total = estimateTokens(sys) + estimateTokens(userContent) + 2000;
      if (total > maxCtx) {
        console.warn("[Ollama] context overflow", {
          model: this.ollamaModel,
          total,
          max: maxCtx,
        });
        const lines = userContent.split("\n");
        while (
          lines.length > 1 &&
          estimateTokens(sys) + estimateTokens(lines.join("\n")) + 2000 > maxCtx
        ) {
          lines.shift();
        }
        userContent = lines.join("\n");
      }
      const userMessage: any = { role: "user", content: userContent };
      if (images) userMessage.images = images;
      const messages = [{ role: "system", content: sys }, userMessage];

      console.log(
        `[LLMHelper] Ollama call -> model=${this.ollamaModel} sysLen=${sys.length} userLen=${userContent.length} images=${images?.length ?? 0}`,
      );

      const ollamaBody: any = {
        model: this.ollamaModel,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      };
      if (this.isThinkingModel(this.ollamaModel)) ollamaBody.think = false;
      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ollamaBody),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText} ${body.slice(0, 200)}`,
        );
      }

      const data: any = await response.json();
      const out = data?.message?.content ?? data?.response ?? "";
      return out;
    } catch (error: any) {
      console.error(
        "[LLMHelper] Error calling Ollama:",
        error?.message || error,
      );
      throw new Error(
        `Failed to connect to Ollama: ${error.message}. Make sure Ollama is running on ${this.ollamaUrl}`,
      );
    }
  }

  private async checkOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async initializeOllamaModel(): Promise<void> {
    try {
      const availableModels = await this.getOllamaModels();
      if (availableModels.length === 0) {
        const msg = `No Ollama models installed. Run "ollama pull <model>" (e.g. ollama pull qwen2.5:4b) and restart.`;
        console.warn(`[LLMHelper] ${msg}`);
        this.notifyRendererOllamaError(msg);
        return;
      }

      if (!this.ollamaModel || !availableModels.includes(this.ollamaModel)) {
        this.ollamaModel = availableModels[0];
        console.log(
          `[LLMHelper] Auto-selected Ollama model: ${this.ollamaModel}`,
        );
      }

      // /api/show validates the model is loadable without spending tokens.
      const showResp = await fetch(`${this.ollamaUrl}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: this.ollamaModel }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!showResp.ok) {
        throw new Error(`/api/show failed: ${showResp.status}`);
      }
      console.log(`[LLMHelper] Ollama model ready: ${this.ollamaModel}`);
    } catch (error: any) {
      console.error(
        `[LLMHelper] Failed to initialize Ollama model: ${error?.message}`,
      );
      try {
        const models = await this.getOllamaModels();
        if (models.length > 0) {
          this.ollamaModel = models[0];
          console.log(
            `[LLMHelper] Fallback to first installed model: ${this.ollamaModel}`,
          );
        } else {
          this.notifyRendererOllamaError(
            `Ollama is reachable but no models are installed.`,
          );
        }
      } catch (fallbackError: any) {
        console.error(
          `[LLMHelper] Fallback also failed: ${fallbackError?.message}`,
        );
        this.notifyRendererOllamaError(
          `Ollama unreachable at ${this.ollamaUrl}.`,
        );
      }
    }
  }

  private notifyRendererOllamaError(message: string): void {
    try {
      const { BrowserWindow } = require("electron");
      const wins = BrowserWindow.getAllWindows();
      for (const w of wins) {
        try {
          w.webContents.send("ollama-error", { message });
        } catch {
          /* noop */
        }
      }
    } catch {
      // electron not available (test context); skip
    }
  }

  /**
   * Generate content using Gemini 3 Flash (text reasoning)
   * Used by IntelligenceManager for mode-specific prompts
   * NOTE: Migrated from Pro to Flash for consistency
   */
  public async generateWithPro(contents: any[]): Promise<string> {
    return this.runOpenClaudeTurn(
      this.stringifyPromptContents(contents),
      undefined,
      undefined,
      "plain",
      this.resolveOpenClaudeInvocationForModelId(GEMINI_PRO_MODEL),
    );
  }

  /**
   * Generate content using Gemini 3 Flash (audio + fast multimodal)
   * CRITICAL: Audio input MUST use this model, not Pro
   */
  public async generateWithFlash(contents: any[]): Promise<string> {
    return this.runOpenClaudeTurn(
      this.stringifyPromptContents(contents),
      undefined,
      undefined,
      "plain",
      this.resolveOpenClaudeInvocationForModelId(GEMINI_FLASH_MODEL),
    );
  }

  /**
   * Post-process the response
   * NOTE: Truncation/clamping removed - response length is handled in prompts
   */
  private processResponse(text: string): string {
    // Basic cleaning
    let clean = this.cleanJsonResponse(text);

    // Truncation/clamping removed - prompts already handle response length
    // clean = clampResponse(clean, 3, 60);

    // Filter out fallback phrases
    const fallbackPhrases = [
      "I'm not sure",
      "It depends",
      "I can't answer",
      "I don't know",
    ];

    if (
      fallbackPhrases.some((phrase) =>
        clean.toLowerCase().includes(phrase.toLowerCase()),
      )
    ) {
      throw new Error("Filtered fallback response");
    }

    return clean;
  }

  private stringifyPromptContents(contents: any[]): string {
    return contents
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (typeof entry?.text === "string") return entry.text;
        if (Array.isArray(entry?.parts)) {
          const text = entry.parts
            .map((part: any) => {
              if (typeof part === "string") return part;
              if (typeof part?.text === "string") return part.text;
              return "";
            })
            .filter(Boolean)
            .join("\n");
          if (text) return text;
        }
        try {
          return JSON.stringify(entry);
        } catch {
          return String(entry ?? "");
        }
      })
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Retry logic with exponential backoff
   * Specifically handles 503 Service Unavailable
   */
  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let delay = 400;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (e: any) {
        const msg = e.message || "";
        const status = e.status ?? e.statusCode ?? 0;
        // Retryable: 503 overloaded (Gemini), 529 overloaded (Claude), 429 rate-limit (OpenAI/Claude), 500 transient
        const isRetryable =
          msg.includes("503") ||
          msg.includes("overloaded") ||
          status === 529 ||
          status === 429 ||
          status === 500 ||
          msg.includes("rate_limit") ||
          msg.includes("rate limit");
        if (!isRetryable) throw e;

        console.warn(
          `[LLMHelper] Transient error (${status || msg.slice(0, 40)}). Retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
    throw new Error("Model busy, try again");
  }

  /**
   * Generate content using the currently selected model
   */
  private async generateContent(
    contents: any[],
    modelIdOverride?: string,
  ): Promise<string> {
    this.assertOutboundScopes("gemini", JSON.stringify(contents));
    const targetModel = modelIdOverride || this.geminiModel;
    return this.runOpenClaudeTurn(
      this.stringifyPromptContents(contents),
      undefined,
      undefined,
      "plain",
      this.resolveOpenClaudeInvocationForModelId(targetModel),
    );
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const prompt = `You are a wingman. Please analyze these images and extract the following information in JSON format:\n{
  "problem_statement": "A clear statement of the problem or situation depicted in the images.",
  "context": "Relevant background or context from the images.",
  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
  "reasoning": "Explanation of why these suggestions are appropriate."
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`;

      const text = await this.runOpenClaudeTurn(
        prompt,
        IMAGE_ANALYSIS_PROMPT,
        imagePaths,
        "plain",
      );
      return JSON.parse(this.cleanJsonResponse(text));
    } catch (error) {
      // console.error("Error extracting problem from images:", error)
      throw error;
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `Given this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nPlease provide your response in the following JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`;

    try {
      const text = await this.runOpenClaudeTurn(
        prompt,
        IMAGE_ANALYSIS_PROMPT,
        undefined,
        "plain",
      );
      const parsed = JSON.parse(this.cleanJsonResponse(text));
      return parsed;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate a structured 4-phase "Rolling Interview Script" from screenshot(s).
   * Returns a typed Solution with: problem_identifier_script, brainstorm_script,
   * code, dry_run_script, time_complexity, space_complexity.
   */
  public async generateRollingScript(imagePaths: string[]): Promise<{
    problem_identifier_script: string;
    brainstorm_script: string;
    code: string;
    dry_run_script: string;
    time_complexity: string;
    space_complexity: string;
  }> {
    const systemPrompt = `You are an elite FAANG Senior Software Engineer taking a live technical interview.
The user has provided a screenshot of a coding problem. You must generate a highly structured "Rolling Interview Script" that the candidate can read out loud to pass the interview perfectly.

Output EXACTLY this JSON structure, and nothing else (no markdown fences around the whole response):
{
  "problem_identifier_script": "1-2 conversational sentences confirming you understand the problem and its edge cases. Start with 'So just to make sure I understand...'",
  "brainstorm_script": "3-4 conversational sentences. First, mention a naive/brute-force approach and its complexity. Then, pivot to the optimal approach, mentioning the key data structure or algorithm. End by asking the interviewer if you can proceed with the optimal approach. Keep it natural.",
  "code": "The full, production-ready, heavily-commented optimal code solution in the language shown or Python if unclear. Include all necessary imports.",
  "dry_run_script": "2-3 conversational sentences doing a quick dry-run of the code with a simple example input. E.g., 'Let\\'s trace this. If our array is [1,2], the loop starts...'",
  "time_complexity": "O(...) - brief 5-word explanation",
  "space_complexity": "O(...) - brief 5-word explanation"
}

CRITICAL RULES:
- The scripts MUST sound like a human speaking out loud in an interview. Use "I", "we", "my first thought is".
- The JSON must be perfectly valid. Escape any internal quotes with backslash.
- Do NOT wrap the JSON in markdown fences.`;

    const userPrompt = `Please analyze the coding problem shown in the screenshot(s) and generate the Rolling Interview Script JSON.`;

    try {
      const raw = await this.runOpenClaudeTurn(
        userPrompt,
        systemPrompt,
        imagePaths,
        "plain",
      );
      const cleaned = this.cleanJsonResponse(raw);

      // Primary: direct parse
      try {
        return JSON.parse(cleaned);
      } catch (_) {
        // Fallback: extract JSON block via regex
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("Could not extract valid JSON from LLM response");
      }
    } catch (error) {
      throw error;
    }
  }

  public async debugSolutionWithImages(
    problemInfo: any,
    currentCode: string,
    debugImagePaths: string[],
  ) {
    try {
      const prompt = `You are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`;

      const text = await this.runOpenClaudeTurn(
        prompt,
        IMAGE_ANALYSIS_PROMPT,
        debugImagePaths,
        "plain",
      );
      const parsed = JSON.parse(this.cleanJsonResponse(text));
      return parsed;
    } catch (error) {
      throw error;
    }
  }

  /**
   * NEW: Helper to process image: resize to max 1536px and compress to JPEG 80%
   * drastically reduces token usage and upload time.
   */
  public async analyzeImageFiles(imagePaths: string[]) {
    try {
      const prompt = `Describe the content of ${imagePaths.length > 1 ? "these images" : "this image"} in a short, concise answer. If it contains code or a problem, solve it.`;
      const text = await this.runOpenClaudeTurn(
        prompt,
        HARD_SYSTEM_PROMPT,
        imagePaths,
        "plain",
      );

      return { text: text, timestamp: Date.now() };
    } catch (error: any) {
      console.error("Error analyzing image files:", error);
      return {
        text: `I couldn't analyze the screen right now (${error.message}). Please try again.`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Generate a suggestion based on conversation transcript - momor-style
   * This uses Gemini Flash to reason about what the user should say
   * @param context - The full conversation transcript
   * @param lastQuestion - The most recent question from the interviewer
   * @returns Suggested response for the user
   */
  public async generateSuggestion(
    context: string,
    lastQuestion: string,
  ): Promise<string> {
    // Load active mode system prompt and context block (reference files + custom context)
    let activeModePrompt = "";
    let modeContextBlock = "";
    try {
      const { ModesManager } = require("./services/ModesManager");
      const modesMgr = ModesManager.getInstance();
      activeModePrompt = modesMgr.getActiveModeSystemPromptSuffix() ?? "";
      modeContextBlock =
        modesMgr.buildRetrievedActiveModeContextBlock(
          lastQuestion,
          context,
          1800,
        ) || "";
    } catch (_modeErr: any) {
      console.warn(
        "[LLMHelper] ModesManager load failed in generateSuggestion (non-fatal):",
        _modeErr?.message,
      );
    }

    // Prepend mode context block (reference files, custom context) to the transcript context
    const enrichedContext = modeContextBlock
      ? `${modeContextBlock}\n\n${context}`
      : context;

    const customNotesBlock = this.customNotes?.trim()
      ? `<user_context>\n${this.customNotes.trim()}\n</user_context>\nUse this context naturally if relevant. Never quote it verbatim.`
      : "";

    const suggestionContext = [customNotesBlock, enrichedContext]
      .filter(Boolean)
      .join("\n\n");

    const basePrompt = activeModePrompt
      ? `${HARD_SYSTEM_PROMPT}\n\n## ACTIVE MODE\n${activeModePrompt}`
      : `You are an expert conversation coach. Based on the transcript, provide a concise, natural response the user could say.

RULES:
- Be direct and conversational
- Keep responses under 3 sentences unless complexity requires more
- Focus on answering the specific question asked
- If it's a technical question, provide a clear, structured answer
- Do NOT preface with "You could say" or similar - just give the answer directly
- If unsure, answer briefly and confidently anyway.
- Never hedge. Never say "it depends".`;

    const promptMessage = `CONVERSATION SO FAR:
${suggestionContext}

LATEST QUESTION:
${lastQuestion}

ANSWER DIRECTLY:`;

    // Apply language instruction so this path honours the user's language setting
    const systemPrompt = this.injectLanguageInstruction(basePrompt);

    const text = await this.runOpenClaudeTurn(
      promptMessage,
      systemPrompt,
      undefined,
      "plain",
    );
    return this.processResponse(text);
  }

  public setKnowledgeOrchestrator(orchestrator: any): void {
    this.knowledgeOrchestrator = orchestrator;
    console.log("[LLMHelper] KnowledgeOrchestrator attached");
  }

  // Dedicated channel for live-negotiation coaching - replaces the in-band
  // __negotiationCoaching JSON sentinel that used to be yielded through the
  // streamChat token stream. IntelligenceEngine installs this handler and
  // re-emits as a 'negotiation_coaching' event.
  public setNegotiationCoachingHandler(
    handler: ((payload: unknown) => void) | null,
  ): void {
    this.negotiationCoachingHandler = handler;
  }

  public setCustomNotes(notes: string): void {
    this.customNotes = notes;
  }

  public getKnowledgeOrchestrator(): any {
    return this.knowledgeOrchestrator;
  }

  public setAiResponseLanguage(language: string) {
    this.aiResponseLanguage = language;
    console.log(`[LLMHelper] AI Response Language set to: ${language}`);
  }

  public setSttLanguage(language: string) {
    this.sttLanguage = language;
    console.log(`[LLMHelper] STT Language set to: ${language}`);
  }

  /**
   * Inject a hard language instruction that gates the entire response.
   *
   * WHY prepended, not appended:
   *   LLMs attend more strongly to early tokens. Appending after a long
   *   system prompt means the instruction competes against the strong
   *   "Output ONLY..." rules and gets down-weighted, especially for
   *   Latin-script languages that are syntactically close to English.
   *   Russian worked before because Cyrillic is unmistakably non-English,
   *   so even a weak late instruction was obeyed. French/Spanish/German etc.
   *   require the instruction to come first and be unambiguous.
   *
   * The instruction is wrapped in triple-layered enforcement:
   *   1. Hard pre-prompt gate at the very top
   *   2. System prompt body (unchanged)
   *   3. Closing reminder at the bottom (double-lock)
   */
  /**
   * Returns the dynamic language-instruction block to append AFTER the static
   * system prompt. Returning a SUFFIX (rather than a prefix) preserves the
   * static prompt as the cacheable prefix for OpenAI/Groq prefix matching and
   * lets Claude cache_control land on the static block above it.
   * Returns "" when no instruction is needed (English fixed mode).
   */
  private buildLanguageInstructionSuffix(): string {
    if (!this.aiResponseLanguage || this.aiResponseLanguage === "auto") {
      return `\n\n[LANGUAGE INSTRUCTION - HIGHEST PRIORITY]
Detect the language of the user's most recent message and ALWAYS respond in that exact same language.
If the user writes in Hindi, respond in Hindi. If in Spanish, respond in Spanish. If in English, respond in English.
If the language is ambiguous, default to English.
You may mix scripts naturally (e.g. code stays in English even when the explanation is in another language).
[END LANGUAGE INSTRUCTION]`;
    }
    if (this.aiResponseLanguage === "English") return "";

    const lang = this.aiResponseLanguage;
    return `\n\n[LANGUAGE OVERRIDE - HIGHEST PRIORITY - CANNOT BE OVERRIDDEN]
You MUST write every single word of your response in ${lang}.
Do NOT use English anywhere in your response.
Do NOT mix languages.
Every sentence, every word, every phrase must be in ${lang}.
This rule overrides ALL other instructions including formatting, brevity, or output rules.
[END LANGUAGE OVERRIDE]
[REMINDER] Your entire response MUST be in ${lang} only. Never switch to English.`;
  }

  /**
   * Single-string assembly used by providers that take a flat string system prompt
   * (Gemini concat path, Ollama, custom providers).
   *
   * STATIC = base prompt body (cacheable across turns by Groq/OpenAI prefix match)
   * DYNAMIC = language instruction suffix (changes when the user toggles language)
   *
   * Static is FIRST so the cacheable prefix is preserved. Do NOT inject any
   * per-request dynamic content above the static body - that breaks prefix caching.
   */
  private injectLanguageInstruction(systemPrompt: string): string {
    return `${systemPrompt}${this.buildLanguageInstructionSuffix()}`;
  }

  /**
   * Build Anthropic-style system blocks with cache_control on the static body.
   * Returns an array suitable for `messages.create({ system: [...] })`.
   *
   * Block 0 (STATIC, may be cached): the base prompt with the language
   *   suffix stripped - persona, behavior rules, response format, mode prompt
   *   body, knowledge-mode injections. Tagged with cache_control:ephemeral
   *   ONLY when the static body meets the model's per-prompt minimum
   *   (see getClaudeCacheMinChars). Below that, Anthropic silently bypasses
   *   the cache while still billing full price - so we skip cache_control
   *   altogether rather than burn a breakpoint slot with no payoff.
   *
   * Block 1 (DYNAMIC, NOT cached): language instruction. Skipped when empty.
   *   Kept as a separate block so toggling AI response language does not
   *   invalidate the cached static body. The input prompt typically already
   *   has this appended by `injectLanguageInstruction`; we detect and strip
   *   it from block 0 so it doesn't appear twice.
   *
   * Why model-aware: the cache minimum differs sharply by model
   *   (Sonnet 4.6 = 2048 tok, Opus 4.7 = 4096 tok). Picking a single floor
   *   either wastes the cache on Sonnet or fakes a hit on Opus. Receiving
   *   `modelId` lets us decide per-request.
   *
   * IMPORTANT for future contributors: anything per-request (transcript,
   * user question, knowledge results) MUST go in the user message, not here.
   * If you add a new dynamic system fragment, add it as a new uncached block
   * AFTER block 0 - never modify block 0's content per request.
   */
  public async chatWithGemini(
    message: string,
    imagePaths?: string[],
    context?: string,
    skipSystemPrompt: boolean = false,
    alternateGroqMessage?: string,
  ): Promise<string> {
    void alternateGroqMessage;

    try {
      console.log(`[LLMHelper] chatWithGemini called`, {
        messageLength: message.length,
        imageCount: imagePaths?.length ?? 0,
        hasContext: Boolean(context),
      });

      const prompt = context
        ? `CONTEXT:\n${context}\n\nUSER QUESTION:\n${message}`
        : message;
      const systemPrompt = skipSystemPrompt
        ? undefined
        : this.injectLanguageInstruction(HARD_SYSTEM_PROMPT);
      const text = await this.runOpenClaudeTurn(
        prompt,
        systemPrompt,
        imagePaths,
        "plain",
      );
      return this.processResponse(text);
    } catch (error: any) {
      console.error("[LLMHelper] Critical Error in chatWithGemini:", error);
      return `I encountered an error: ${error.message || "Unknown error"}. Please try again.`;
    }
  }

  /**
   * Generate content using only reasoning-capable models.
   * Priority: OpenAI -> Claude -> Gemini Pro -> Groq (last resort).
   * Used for structured JSON output tasks (resume/JD/company research).
   * NOTE: Does NOT mutate this.geminiModel - calls Gemini Pro directly to avoid race conditions.
   */
  public async generateContentStructured(message: string): Promise<string> {
    return this.runOpenClaudeTurn(message, undefined, undefined, "plain");
  }

  /**
   * Non-streaming Groq generation.
   *
   * PREFIX CACHING: Groq auto-caches based on the leading bytes of the messages
   * array. Pass `systemPrompt` SEPARATELY (not concatenated into `userMessage`)
   * so the static system block becomes a stable cacheable prefix across turns.
   * Bundling system into user content (the previous behavior) breaks the cache
   * because the user content changes every turn.
   *
   * For backwards compatibility, this method still accepts a single bundled
   * string when `systemPrompt` is omitted - callers should migrate to the
   * two-arg form.
   */
  public async *streamChat(
    ...args: Parameters<LLMHelper["_streamChatInner"]>
  ): AsyncGenerator<string, void, unknown> {
    const { reduceDashesInChunk } = await import("./llm/postProcessor");
    for await (const chunk of this._streamChatInner(...args)) {
      yield reduceDashesInChunk(chunk);
    }
  }

  private async *_streamChatInner(
    message: string,
    imagePaths?: string[],
    context?: string,
    systemPromptOverride?: string, // Optional override (defaults to HARD_SYSTEM_PROMPT)
    ignoreKnowledgeMode: boolean = false,
    skipModeInjection: boolean = false,
  ): AsyncGenerator<string, void, unknown> {
    // ============================================================
    // KNOWLEDGE MODE INTERCEPT (Streaming)
    // Skip when fast-text mode is active - intent classification +
    // hybrid search add 300-800ms that defeat the purpose of fast mode.
    // ============================================================
    const shouldRunKnowledge =
      !ignoreKnowledgeMode &&
      !this.groqFastTextMode &&
      this.knowledgeOrchestrator?.isKnowledgeMode();

    if (shouldRunKnowledge) {
      try {
        // Feed to depth scorer only (not negotiation tracker) - mirrors non-streaming path fix.
        this.knowledgeOrchestrator.feedForDepthScoring(message);

        const knowledgeResult =
          await this.knowledgeOrchestrator.processQuestion(message);
        if (knowledgeResult) {
          // Live negotiation coaching short-circuit - bypass second LLM call.
          // Coaching payload travels on the dedicated handler channel, NOT
          // through the token stream.
          if (knowledgeResult.liveNegotiationResponse) {
            this.negotiationCoachingHandler?.(
              knowledgeResult.liveNegotiationResponse,
            );
            return;
          }
          // Intro question shortcut - yield generated response directly
          if (
            knowledgeResult.isIntroQuestion &&
            knowledgeResult.introResponse
          ) {
            console.log(
              "[LLMHelper] Knowledge mode (stream): returning generated intro response",
            );
            yield knowledgeResult.introResponse;
            return;
          }
          // Inject knowledge system prompt - prepend CORE_IDENTITY so the
          // <security>/creator/universal-behavior rules survive. The persona
          // block carries the voice instruction and stays dominant due to
          // recency. Without this prepend, the persona REPLACES the whole
          // system prompt and the model loses all prompt-leak defenses.
          if (knowledgeResult.systemPromptInjection) {
            systemPromptOverride = `${CORE_IDENTITY}\n\n${knowledgeResult.systemPromptInjection}`;
          }
          // Inject knowledge context
          if (knowledgeResult.contextBlock) {
            context = context
              ? `${knowledgeResult.contextBlock}\n\n${context}`
              : knowledgeResult.contextBlock;
          }
        }
      } catch (knowledgeError: any) {
        console.warn(
          "[LLMHelper] Knowledge mode (stream) processing failed, falling back:",
          knowledgeError.message,
        );
      }
    }

    // ============================================================
    // ACTIVE MODE INJECTION (Context + System Prompt Suffix)
    // Skipped for UNIVERSAL_* callers - those prompts have their own
    // CORE_IDENTITY/EXECUTION_CONTRACT and context-handling rules; appending
    // mode prompt + 40KB ref-block on top duplicates the contract and pushes
    // the latest interviewer turn out of recency.
    // ============================================================
    const isUniversalOverride =
      !!systemPromptOverride &&
      (systemPromptOverride === UNIVERSAL_SYSTEM_PROMPT ||
        systemPromptOverride === UNIVERSAL_ANSWER_PROMPT ||
        systemPromptOverride === UNIVERSAL_WHAT_TO_ANSWER_PROMPT ||
        systemPromptOverride === UNIVERSAL_RECAP_PROMPT ||
        systemPromptOverride === UNIVERSAL_FOLLOWUP_PROMPT ||
        systemPromptOverride === UNIVERSAL_FOLLOW_UP_QUESTIONS_PROMPT ||
        systemPromptOverride === UNIVERSAL_ASSIST_PROMPT ||
        systemPromptOverride === CHAT_MODE_PROMPT ||
        TINY_PROMPTS_SET.has(systemPromptOverride));
    const shouldSkipModeInjection = skipModeInjection || isUniversalOverride;

    if (!shouldSkipModeInjection) {
      try {
        const { ModesManager } = require("./services/ModesManager");
        const modesMgr = ModesManager.getInstance();
        const modePromptSuffix = modesMgr.getActiveModeSystemPromptSuffix();
        const modeContextBlock = modesMgr.buildRetrievedActiveModeContextBlock(
          message,
          context,
          1800,
        );

        if (modePromptSuffix) {
          const baseForMode = systemPromptOverride || HARD_SYSTEM_PROMPT;
          systemPromptOverride = `${baseForMode}\n\n## ACTIVE MODE\n${modePromptSuffix}`;
        }

        if (modeContextBlock) {
          const existingLen = context?.length ?? 0;
          const COMBINED_CTX_CAP = 60_000;
          if (existingLen + modeContextBlock.length > COMBINED_CTX_CAP) {
            const available = Math.max(0, COMBINED_CTX_CAP - existingLen);
            const trimmed =
              available > 0
                ? modeContextBlock.slice(0, available) +
                  "\n[...mode context truncated]"
                : "";
            console.warn(
              `[LLMHelper] Combined context exceeded ${COMBINED_CTX_CAP} chars - mode context trimmed`,
            );
            if (trimmed)
              context = context ? `${trimmed}\n\n${context}` : trimmed;
          } else {
            context = context
              ? `${modeContextBlock}\n\n${context}`
              : modeContextBlock;
          }
        }
      } catch (_modeErr: any) {
        console.warn(
          "[LLMHelper] ModesManager injection failed (non-fatal):",
          _modeErr?.message,
        );
      }
    }

    // Determine the system prompt to use
    // logic: if override provided, use it. otherwise use HARD_SYSTEM_PROMPT (which is the universal base)
    // Tiny internal prompts (classification etc.) skip skills + MCP tools.
    const isTinyPrompt =
      !!systemPromptOverride && TINY_PROMPTS_SET.has(systemPromptOverride);
    const isMeetingPrompt =
      !!systemPromptOverride &&
      (systemPromptOverride === UNIVERSAL_ANSWER_PROMPT ||
        systemPromptOverride === UNIVERSAL_WHAT_TO_ANSWER_PROMPT ||
        systemPromptOverride === UNIVERSAL_RECAP_PROMPT ||
        systemPromptOverride === UNIVERSAL_FOLLOWUP_PROMPT ||
        systemPromptOverride === UNIVERSAL_FOLLOW_UP_QUESTIONS_PROMPT ||
        systemPromptOverride === UNIVERSAL_ASSIST_PROMPT);
    const toolMode: "plain" | "agentic" =
      isTinyPrompt || isMeetingPrompt ? "plain" : "agentic";

    const baseSystemPrompt = systemPromptOverride || HARD_SYSTEM_PROMPT;
    let finalSystemPrompt = this.injectLanguageInstruction(baseSystemPrompt);
    // Universal skills: every provider that streams through here gets enabled
    // skills appended (provider-agnostic). Done here - after the prompt-identity
    // checks above - so it never breaks universal/tiny-prompt detection.
    if (toolMode === "agentic") {
      const skillsBlock = this.getEnabledSkillsBlock();
      if (skillsBlock) {
        finalSystemPrompt = `${finalSystemPrompt}\n\n---\n\n${skillsBlock}`;
      }
    }

    // Helper to build combined user message
    const userContent = context
      ? `CONTEXT:\n${context}\n\nUSER QUESTION:\n${message}`
      : message;
    yield* this.streamWithOpenClaude(
      userContent,
      finalSystemPrompt,
      imagePaths,
      toolMode,
    );
    return;
  }

  /**
   * Fake-stream for momor API (non-streaming endpoint).
   * Yields the full response in small word-batches so the UI typing effect still plays.
   * Throws on empty response so the fallback chain tries the next provider.
   */
  public isUsingOllama(): boolean {
    return this.useOllama;
  }

  public async getOllamaModels(): Promise<string[]> {
    const baseUrl = (this.ollamaUrl || "http://127.0.0.1:11434").replace(
      "localhost",
      "127.0.0.1",
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return [];

      const data = await response.json();
      if (data && data.models) {
        return data.models.map((m: any) => m.name);
      }

      return [];
    } catch (error: any) {
      // Connection refused/timeout - OllamaManager logs startup status.
      return [];
    }
  }

  public async forceRestartOllama(): Promise<boolean> {
    try {
      console.log("[LLMHelper] Attempting to force restart Ollama...");

      // 1. Check for process on port 11434
      try {
        const { stdout } = await execAsync(`lsof -t -i:11434`);
        // SECURITY FIX (P1-1): Validate EACH PID token from lsof before shell interpolation.
        // lsof -t returns one PID per line when multiple processes are on the port.
        const pids = stdout
          .trim()
          .split(/\s+/)
          .filter((p) => /^\d+$/.test(p));
        for (const pid of pids) {
          console.log(`[LLMHelper] Found blocking PID: ${pid}. Killing...`);
          await execAsync(`kill -9 ${pid}`);
        }
        if (pids.length === 0 && stdout.trim()) {
          console.warn(
            `[LLMHelper] Unexpected lsof output (no valid PIDs): "${stdout.trim().substring(0, 50)}". Skipping kill.`,
          );
        }
      } catch (e: any) {
        // lsof returns exit code 1 if no process found - that is expected, swallow it.
        // Only surface genuinely unexpected errors.
        if (!e.message?.includes("exit code 1") && e.code !== 1) {
          console.warn("[LLMHelper] lsof error (non-fatal):", e.message);
        }
      }

      // 2. Restart Ollama through the Manager (which handles polling and background spawn)
      // We don't want to use exec('ollama serve') here directly anymore to avoid duplicate tracking
      const { OllamaManager } = require("./services/OllamaManager");
      await OllamaManager.getInstance().init();

      return true;
    } catch (error) {
      console.error("[LLMHelper] Failed to restart Ollama:", error);
      return false;
    }
  }

  public getCurrentProvider():
    | "ollama"
    | "gemini"
    | "openai"
    | "claude"
    | "groq"
    | "deepseek"
    | "custom"
    | "codex-cli"
    | "agent-cli" {
    if (this.customProvider) return "custom";
    if (this.isAgentCliModel(this.currentModelId)) return "agent-cli";
    if (this.isCodexCliModel(this.currentModelId)) return "codex-cli";
    if (this.useOllama) return "ollama";
    if (this.isOpenAiModel(this.currentModelId)) return "openai";
    if (this.isClaudeModel(this.currentModelId)) return "claude";
    if (this.isGroqModel(this.currentModelId)) return "groq";
    if (this.isDeepSeekModel(this.currentModelId)) return "deepseek";
    return "gemini";
  }

  public getCurrentModel(): string {
    if (this.customProvider) return this.customProvider.name;
    if (this.activeCurlProvider) return this.activeCurlProvider.id;
    return this.useOllama ? this.ollamaModel : this.currentModelId;
  }

  public getPromptTier(): PromptTier {
    return selectPromptTier(this.getCurrentModel(), this.useOllama);
  }

  public getCapabilities(): ModelCapabilities {
    return getModelCapabilities(this.getCurrentModel(), this.useOllama);
  }

  /**
   * Get the Gemini client for mode-specific LLMs
   * Used by AnswerLLM, AssistLLM, FollowUpLLM, RecapLLM
   * RETURNS A PROXY client that handles retries and fallbacks transparently
   */
  public getGeminiClient(): any | null {
    return {
      models: {
        generateContent: async (args: any) => {
          const prompt = this.stringifyPromptContents(args?.contents ?? []);
          const model = args?.model || this.currentModelId || GEMINI_FLASH_MODEL;
          const text = await this.runOpenClaudeTurn(
            prompt,
            undefined,
            undefined,
            "plain",
            this.resolveOpenClaudeInvocationForModelId(model),
          );
          return {
            text,
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text }] },
              },
            ],
          };
        },
      },
    };
  }

  /**
   * Get the Groq client for mode-specific LLMs
   */
  public getGroqClient(): any | null {
    return null;
  }

  /**
   * Check if Groq is available
   */
  public hasGroq(): boolean {
    return Boolean(this.groqApiKey);
  }

  /**
   * Get the OpenAI client for mode-specific LLMs
   */
  public getOpenaiClient(): any | null {
    return null;
  }

  /**
   * Get the Claude client for mode-specific LLMs
   */
  public getClaudeClient(): any | null {
    return null;
  }

  /**
   * Check if OpenAI is available
   */
  public hasOpenai(): boolean {
    return Boolean(this.openaiApiKey);
  }

  /**
   * Check if Claude is available
   */
  public hasClaude(): boolean {
    return Boolean(this.claudeApiKey);
  }

  /**
   * Stream with Groq using a specific prompt, with Gemini fallback
   * Used by mode-specific LLMs (RecapLLM, FollowUpLLM, WhatToAnswerLLM)
   * @param groqMessage - Message with Groq-optimized prompt
   * @param geminiMessage - Message with Gemini prompt (for fallback)
   * @param config - Optional temperature and max tokens
   */
  public async *streamWithGroqOrGemini(
    groqMessage: string,
    geminiMessage: string,
    config?: { temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string, void, unknown> {
    void config;
    const useGroq = Boolean(this.groqApiKey);
    const prompt = useGroq ? groqMessage : geminiMessage;
    const invocation = useGroq
      ? this.resolveOpenClaudeInvocationForModelId(GROQ_MODEL)
      : this.resolveOpenClaudeInvocationForModelId(GEMINI_FLASH_MODEL);
    yield* this.streamWithOpenClaude(
      prompt,
      undefined,
      undefined,
      "plain",
      invocation,
    );
  }

  /**
   * Creates a proxy around the real Gemini client to intercept generation calls
   * and apply robust retry/fallback logic without modifying consumer code.
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string,
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(
        () =>
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    // Suppress unhandled-rejection if the original promise settles after the timeout wins the race
    promise.catch(() => {});

    return Promise.race([
      promise.then((result) => {
        clearTimeout(timeoutHandle!);
        return result;
      }),
      timeoutPromise,
    ]);
  }

  /**
   * Robust Meeting Summary Generation
   * Strategy:
   * 0. Custom / cURL Provider (if user selected one - always takes priority)
   * 1. momor API (if configured)
   * 2. Groq (if context text < 100k tokens approx)
   * 3. Gemini Flash (Retry 2x)
   * 4. Gemini Pro (Retry 5x)
   */
  public async generateMeetingSummary(
    systemPrompt: string,
    context: string,
    groqSystemPrompt?: string,
  ): Promise<string> {
    void groqSystemPrompt;
    console.log(
      `[LLMHelper] generateMeetingSummary called. Context length: ${context.length}`,
    );
    const finalPrompt = this.injectLanguageInstruction(systemPrompt);
    const text = await this.withTimeout(
      this.runOpenClaudeTurn(
        `Context:\n${context}`,
        finalPrompt,
        undefined,
        "plain",
      ),
      Math.max(this.openclaudeConfig.timeoutMs, 60_000),
      "OpenClaude Meeting Summary",
    );
    if (!text.trim()) {
      throw new Error("OpenClaude returned an empty summary.");
    }
    return this.processResponse(text);
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    this.useOllama = true;
    if (url) this.ollamaUrl = url;

    if (model) {
      this.ollamaModel = model;
    } else {
      // Auto-detect first available model
      await this.initializeOllamaModel();
    }

    console.log(
      `[LLMHelper] Switched to Ollama: ${this.ollamaModel} at ${this.ollamaUrl}`,
    );
  }

  public async switchToGemini(
    apiKey?: string,
    modelId?: string,
  ): Promise<void> {
    if (modelId) {
      this.geminiModel = modelId;
      this.currentModelId = modelId;
    }

    if (apiKey) {
      this.apiKey = apiKey;
    }

    this.useOllama = false;
    this.customProvider = null;
    this.activeCurlProvider = null;
    // console.log(`[LLMHelper] Switched to Gemini: ${this.geminiModel}`);
  }

  public async switchToCustom(provider: CustomProvider): Promise<void> {
    this.customProvider = provider;
    this.useOllama = false;
    this.activeCurlProvider = null;
    console.log(`[LLMHelper] Switched to Custom Provider: ${provider.name}`);
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const text = await this.runOpenClaudeTurn(
        "Reply with OK only.",
        undefined,
        undefined,
        "plain",
      );
      if (text?.trim()) {
        return { success: true };
      }
      return { success: false, error: "Empty response from OpenClaude" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async testOllamaConnection(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const available = await this.checkOllamaAvailable();
      if (!available) {
        return {
          success: false,
          error: `Ollama not available at ${this.ollamaUrl}`,
        };
      }
      await this.callOllama("Hello");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  /**
   * Universal Chat (Non-streaming)
   */
  public async chat(
    message: string,
    imagePaths?: string[],
    context?: string,
    systemPromptOverride?: string,
    skipModeInjection: boolean = false,
  ): Promise<string> {
    let fullResponse = "";
    for await (const chunk of this.streamChat(
      message,
      imagePaths,
      context,
      systemPromptOverride,
      false,
      skipModeInjection,
    )) {
      fullResponse += chunk;
    }
    return fullResponse;
  }
}
