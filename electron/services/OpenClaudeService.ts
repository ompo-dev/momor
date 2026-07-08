import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface OpenClaudeConfig {
  enabled: boolean;
  executablePath: string;
  model: string;
  timeoutMs: number;
}

export interface OpenClaudeRunOptions {
  prompt: string;
  model?: string;
  timeoutMs?: number;
  imagePaths?: string[];
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

export interface OpenClaudeAuthStatus {
  loggedIn: boolean;
  authMethod: string;
  apiProvider?: string | null;
  email?: string | null;
  orgName?: string | null;
}

export interface OpenClaudeModelOption {
  value: string;
  label: string;
  profileId?: string;
  provider?: string;
}

export interface OpenClaudeProfileSummary {
  id: string;
  name: string;
  provider: string;
  models: string[];
}

export const DEFAULT_OPENCLAUDE_CONFIG: OpenClaudeConfig = {
  enabled: false,
  executablePath: "C:\\Projects\\Teste\\openclaude\\dist\\cli.mjs",
  model: "claude-sonnet-4-6",
  timeoutMs: 120_000,
};

const DEFAULT_ANTHROPIC_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "sonnet",
  "opus",
  "haiku",
];

type CliRunResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

function parseModelList(modelField: string): string[] {
  return modelField
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function imageMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

function buildPromptStdin(
  prompt: string,
  imagePaths: string[] = [],
): { stdinPrompt: string } {
  if (!imagePaths.length) {
    return {
      stdinPrompt: prompt,
    };
  }

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const imagePath of imagePaths) {
    if (!imagePath || !fs.existsSync(imagePath)) continue;
    try {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: imageMimeTypeFromPath(imagePath),
          data: fs.readFileSync(imagePath).toString("base64"),
        },
      });
    } catch {
      // Ignore unreadable images and keep the text turn alive.
    }
  }

  return {
    stdinPrompt:
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: content.length === 1 ? prompt : content,
        },
        parent_tool_use_id: null,
      }) + "\n",
  };
}

export class OpenClaudeService {
  public static isAvailable(config: OpenClaudeConfig): boolean {
    if (!config.enabled) return false;
    const p = config.executablePath;
    if (p.endsWith(".mjs") || p.endsWith(".js")) {
      return fs.existsSync(p);
    }
    return true;
  }

  public static buildArgs(
    model: string,
    imagePaths: string[] = [],
  ): string[] {
    const args = ["--print", "--output-format", "text"];
    if (model) {
      args.push("--model", model);
    }
    if (imagePaths.length) {
      args.push("--input-format", "stream-json");
    }
    return args;
  }

  public static buildCommand(config: OpenClaudeConfig): {
    cmd: string;
    baseArgs: string[];
    envPatch: NodeJS.ProcessEnv;
    useShell: boolean;
  } {
    const p = config.executablePath.trim();
    if (p.endsWith(".mjs") || p.endsWith(".js")) {
      return {
        cmd: process.execPath,
        baseArgs: [p],
        envPatch: { ELECTRON_RUN_AS_NODE: "1" },
        useShell: false,
      };
    }
    return {
      cmd: p,
      baseArgs: [],
      envPatch: {},
      useShell:
        process.platform === "win32" &&
        (!p.includes(path.sep) || /\.(cmd|bat)$/i.test(p)),
    };
  }

  private static runCli(
    config: OpenClaudeConfig,
    subArgs: string[],
    timeoutMs: number,
  ): Promise<CliRunResult> {
    const { cmd, baseArgs, envPatch, useShell } = this.buildCommand(config);
    const args = [...baseArgs, ...subArgs];

    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        env: { ...process.env, ...envPatch },
        stdio: ["ignore", "pipe", "pipe"],
        shell: useShell,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(
          new Error(
            `OpenClaude CLI timeout after ${timeoutMs}ms: ${stderr.slice(0, 300)}`,
          ),
        );
      }, timeoutMs);

      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, code });
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /** Opens a visible terminal on Windows for interactive CLI login flows. */
  public static spawnInteractiveLogin(
    kind: "openclaude" | "codex",
    executablePath: string,
  ): { success: boolean; message?: string; error?: string } {
    const cliPath = executablePath.trim();
    if (!cliPath) {
      return { success: false, error: "CLI path is required" };
    }

    try {
      if (process.platform === "win32") {
        if (kind === "codex") {
          spawn("cmd.exe", ["/c", "start", "cmd", "/k", cliPath, "login"], {
            detached: true,
            stdio: "ignore",
            windowsHide: false,
          }).unref();
        } else if (cliPath.endsWith(".mjs") || cliPath.endsWith(".js")) {
          spawn(
            "cmd.exe",
            ["/c", "start", "cmd", "/k", "node", cliPath, "auth", "login"],
            { detached: true, stdio: "ignore", windowsHide: false },
          ).unref();
        } else {
          spawn(
            "cmd.exe",
            ["/c", "start", "cmd", "/k", cliPath, "auth", "login"],
            { detached: true, stdio: "ignore", windowsHide: false },
          ).unref();
        }
      } else if (process.platform === "darwin") {
        const inner =
          kind === "codex"
            ? `${JSON.stringify(cliPath)} login`
            : cliPath.endsWith(".mjs") || cliPath.endsWith(".js")
              ? `node ${JSON.stringify(cliPath)} auth login`
              : `${JSON.stringify(cliPath)} auth login`;
        spawn("osascript", [
          "-e",
          `tell application "Terminal" to do script ${JSON.stringify(inner)}`,
        ]).unref();
      } else {
        const args =
          kind === "codex"
            ? [cliPath, "login"]
            : cliPath.endsWith(".mjs") || cliPath.endsWith(".js")
              ? ["node", cliPath, "auth", "login"]
              : [cliPath, "auth", "login"];
        spawn("x-terminal-emulator", ["-e", ...args], {
          detached: true,
          stdio: "ignore",
        }).unref();
      }

      return {
        success: true,
        message:
          "Login started in a terminal window. Complete OAuth in the browser, then refresh status.",
      };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Failed to start login",
      };
    }
  }

  public static async authLogin(
    config: OpenClaudeConfig,
    timeoutMs = 180_000,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const result = await this.runCli(
        config,
        ["auth", "login"],
        timeoutMs,
      );
      if (result.code === 0) {
        return {
          success: true,
          message:
            result.stdout.trim() || "Login successful.",
        };
      }
      const detail = (result.stderr || result.stdout).trim();
      return {
        success: false,
        error: detail || `Login failed (exit ${result.code})`,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/timeout/i.test(msg)) {
        return this.spawnInteractiveLogin("openclaude", config.executablePath);
      }
      return { success: false, error: msg };
    }
  }

  public static async authLogout(
    config: OpenClaudeConfig,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const result = await this.runCli(config, ["auth", "logout"], 30_000);
      if (result.code === 0) {
        return {
          success: true,
          message: result.stdout.trim() || "Logged out.",
        };
      }
      return {
        success: false,
        error: (result.stderr || result.stdout).trim() || "Logout failed",
      };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Logout failed",
      };
    }
  }

  public static async getAuthStatus(
    config: OpenClaudeConfig,
  ): Promise<OpenClaudeAuthStatus> {
    try {
      const result = await this.runCli(
        config,
        ["auth", "status", "--json"],
        30_000,
      );
      const jsonText = result.stdout.trim();
      if (jsonText) {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        return {
          loggedIn: Boolean(parsed.loggedIn),
          authMethod: String(parsed.authMethod ?? "none"),
          apiProvider:
            typeof parsed.apiProvider === "string"
              ? parsed.apiProvider
              : null,
          email:
            typeof parsed.email === "string" ? parsed.email : null,
          orgName:
            typeof parsed.orgName === "string" ? parsed.orgName : null,
        };
      }
    } catch {
      // fall through
    }
    return { loggedIn: false, authMethod: "none" };
  }

  public static getGlobalConfigPaths(): string[] {
    const home = os.homedir();
    return [
      path.join(home, ".openclaude.json"),
      path.join(home, ".openclaude", ".config.json"),
      path.join(home, ".claude.json"),
    ];
  }

  public static readGlobalConfig(): Record<string, unknown> | null {
    for (const filePath of this.getGlobalConfigPaths()) {
      const config = readJsonFile(filePath);
      if (config) return config;
    }
    return null;
  }

  public static listProfilesFromConfig(
    config: Record<string, unknown> | null,
  ): OpenClaudeProfileSummary[] {
    if (!config) return [];
    const rawProfiles = config.providerProfiles;
    if (!Array.isArray(rawProfiles)) return [];

    const profiles: OpenClaudeProfileSummary[] = [];
    for (const entry of rawProfiles) {
      if (!entry || typeof entry !== "object") continue;
      const p = entry as Record<string, unknown>;
      const id = typeof p.id === "string" ? p.id : "";
      const name = typeof p.name === "string" ? p.name : id;
      const provider = typeof p.provider === "string" ? p.provider : "";
      const modelField = typeof p.model === "string" ? p.model : "";
      const models = parseModelList(modelField);
      if (!id || models.length === 0) continue;
      profiles.push({ id, name, provider, models });
    }
    return profiles;
  }

  public static listAvailableModels(
    config?: Record<string, unknown> | null,
  ): OpenClaudeModelOption[] {
    const globalConfig = config ?? this.readGlobalConfig();
    const profiles = this.listProfilesFromConfig(globalConfig);
    const activeId =
      typeof globalConfig?.activeProviderProfileId === "string"
        ? globalConfig.activeProviderProfileId
        : undefined;

    const seen = new Set<string>();
    const options: OpenClaudeModelOption[] = [];

    const push = (opt: OpenClaudeModelOption) => {
      if (seen.has(opt.value)) return;
      seen.add(opt.value);
      options.push(opt);
    };

    const cacheByProfile = globalConfig?.openaiAdditionalModelOptionsCacheByProfile;
    if (cacheByProfile && typeof cacheByProfile === "object") {
      for (const [profileId, cached] of Object.entries(
        cacheByProfile as Record<string, unknown>,
      )) {
        if (!Array.isArray(cached)) continue;
        for (const item of cached) {
          if (!item || typeof item !== "object") continue;
          const model = item as Record<string, unknown>;
          const value =
            typeof model.value === "string"
              ? model.value
              : typeof model.id === "string"
                ? model.id
                : "";
          if (!value) continue;
          const label =
            typeof model.label === "string" ? model.label : value;
          push({ value, label, profileId });
        }
      }
    }

    for (const profile of profiles) {
      for (const model of profile.models) {
        const suffix =
          profile.id === activeId ? " ★" : "";
        push({
          value: model,
          label: `${profile.name} (${profile.provider}): ${model}${suffix}`,
          profileId: profile.id,
          provider: profile.provider,
        });
      }
    }

    if (options.length === 0) {
      for (const model of DEFAULT_ANTHROPIC_MODELS) {
        push({ value: model, label: model, provider: "anthropic" });
      }
    }

    return options;
  }

  public static async run(
    config: OpenClaudeConfig,
    options: OpenClaudeRunOptions,
  ): Promise<string> {
    const { cmd, baseArgs, envPatch, useShell } = this.buildCommand(config);
    const model = options.model ?? config.model;
    const promptPayload = buildPromptStdin(options.prompt, options.imagePaths);
    const args = [...baseArgs, ...this.buildArgs(model, options.imagePaths)];
    const timeoutMs = options.timeoutMs ?? config.timeoutMs;

    return new Promise<string>((resolve, reject) => {
      const proc = spawn(cmd, args, {
        env: { ...process.env, ...envPatch, ...(options.env ?? {}) },
        stdio: ["pipe", "pipe", "pipe"],
        shell: useShell,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error(`OpenClaude timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          proc.kill("SIGTERM");
          reject(new Error("OpenClaude aborted"));
        });
      }

      try {
        proc.stdin?.write(promptPayload.stdinPrompt);
        proc.stdin?.end();
      } catch {
        // stdin failures surface via the existing process error/close handlers.
      }

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`OpenClaude exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
