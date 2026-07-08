/**
 * AgentRegistry — Zed-style catalog of external agents.
 *
 * Builtin entries cover the CLIs we ship adapters for; users can add any
 * ACP-speaking agent ("Add More Agents" in Zed) as a custom entry with a
 * command + args + env — e.g. `npx @zed-industries/claude-code-acp`,
 * `codex-acp`, `gemini --experimental-acp`, `cursor-agent acp`.
 *
 * transport:
 *   acp                — persistent ACP session over stdio (preferred when the
 *                        CLI speaks it; opencode does natively)
 *   claude-stream-json — one-shot `--print --output-format stream-json`
 *   codex-exec         — one-shot `codex exec --json`
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { AgentCliSettings, AgentProvider } from "./types";
import { buildAdapter } from "./AgentOrchestrator";

export type AgentTransport = "acp" | "claude-stream-json" | "codex-exec";

export interface ExternalAgentSpec {
  id: string;
  name: string;
  transport: AgentTransport;
  builtin: boolean;
  /** Resolved launch command (absolute path or bare PATH command). */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  available: boolean;
}

export interface CustomAgentSettings {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

const BUILTIN_TRANSPORT: Record<AgentProvider, AgentTransport> = {
  claude: "claude-stream-json",
  openclaude: "claude-stream-json",
  codex: "codex-exec",
  opencode: "acp",
};

const BUILTIN_NAMES: Record<AgentProvider, string> = {
  claude: "Claude Code (system)",
  openclaude: "Claude Code",
  codex: "Codex CLI",
  opencode: "OpenCode",
};

function isPathLikeExecutable(candidate: string): boolean {
  return (
    path.isAbsolute(candidate) ||
    candidate.includes(path.sep) ||
    /[\\/]/.test(candidate)
  );
}

function isRunnableBareCommand(candidate: string): boolean {
  return (
    candidate.length > 0 &&
    candidate.length <= 240 &&
    !/[\r\n]/.test(candidate) &&
    !/\s/.test(candidate) &&
    !isPathLikeExecutable(candidate)
  );
}

function resolveExecutable(
  provider: AgentProvider,
  configured?: string,
): string | null {
  const trimmed = configured?.trim() ?? "";
  if (trimmed) {
    if (isPathLikeExecutable(trimmed)) {
      if (fs.existsSync(trimmed)) return trimmed;
    } else if (isRunnableBareCommand(trimmed)) {
      return trimmed;
    }
  }
  const adapter = buildAdapter(provider);
  for (const candidate of adapter.defaultPaths()) {
    if (isPathLikeExecutable(candidate) && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  const bare = adapter
    .defaultPaths()
    .find((candidate) => isRunnableBareCommand(candidate.trim()));
  return bare || null;
}

/** opencode launch spec for ACP: `opencode acp` (native support). */
function opencodeAcpLaunch(executable: string): { command: string; args: string[]; env: Record<string, string> } {
  // Extensionless node launcher scripts (repo bin/opencode) can't be exec'd
  // directly on Windows — run them through Electron-as-Node.
  const isScript = /\.(mjs|cjs|js)$/i.test(executable) ||
    (!/\.(exe|cmd|bat)$/i.test(executable) && path.isAbsolute(executable) && looksLikeNodeScript(executable));
  if (isScript) {
    return {
      command: process.execPath,
      args: [executable, "acp"],
      env: { ELECTRON_RUN_AS_NODE: "1" },
    };
  }
  return { command: executable, args: ["acp"], env: {} };
}

function looksLikeNodeScript(file: string): boolean {
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(64);
    fs.readSync(fd, buf, 0, 64, 0);
    fs.closeSync(fd);
    const head = buf.toString("utf8");
    return head.startsWith("#!") && head.includes("node");
  } catch {
    return false;
  }
}

export class AgentRegistry {
  /** All agents (builtin + custom), with availability resolved. */
  static list(settings: AgentCliSettings & { customAgents?: CustomAgentSettings[] }): ExternalAgentSpec[] {
    const out: ExternalAgentSpec[] = [];

    for (const provider of Object.keys(BUILTIN_TRANSPORT) as AgentProvider[]) {
      const resolved = resolveExecutable(provider, settings.executablePaths?.[provider]);
      const concrete = Boolean(resolved && (resolved.includes(path.sep) ? fs.existsSync(resolved) : true));
      let command = resolved ?? undefined;
      let args: string[] | undefined;
      let env: Record<string, string> | undefined;
      if (provider === "opencode" && resolved) {
        const launch = opencodeAcpLaunch(resolved);
        command = launch.command;
        args = launch.args;
        env = launch.env;
      }
      out.push({
        id: provider,
        name: BUILTIN_NAMES[provider],
        transport: BUILTIN_TRANSPORT[provider],
        builtin: true,
        command,
        args,
        env,
        available: concrete,
      });
    }

    for (const custom of settings.customAgents ?? []) {
      if (!custom?.id || !custom?.command) continue;
      const concrete = custom.command.includes(path.sep)
        ? fs.existsSync(custom.command)
        : true; // bare command — PATH decides at spawn time
      out.push({
        id: custom.id,
        name: custom.name || custom.id,
        transport: "acp",
        builtin: false,
        command: custom.command,
        args: custom.args ?? [],
        env: custom.env ?? {},
        available: concrete,
      });
    }

    return out;
  }

  static find(
    id: string,
    settings: AgentCliSettings & { customAgents?: CustomAgentSettings[] },
  ): ExternalAgentSpec | undefined {
    return AgentRegistry.list(settings).find((a) => a.id === id);
  }
}

export function defaultWorkspaceBase(): string {
  return path.join(os.homedir(), "Momor");
}
