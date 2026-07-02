/**
 * AgentOrchestrator — provider-agnostic engine that runs a CLI agent and
 * streams normalized AgentEvents. It owns:
 *   • adapter selection (claude / openclaude / opencode / codex)
 *   • executable path resolution (configured path → default candidates)
 *   • workspace + permission resolution
 *   • MCP injection (temp config for claude; opencode.json for opencode)
 *   • spawn + line-buffered stdout parsing + cancellation
 *   • per-meeting CLI session continuity (resume / --session)
 *   • audit logging
 *
 * The renderer/IPC layer only ever sees AgentEvent. One run is in flight at a
 * time per orchestrator instance (the meeting agent is single-user).
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  AgentAdapter,
  AgentEvent,
  AgentProvider,
  AgentRunOptions,
  AdapterContext,
  AgentCliSettings,
  AGENT_PROVIDERS,
  createParseState,
} from "./types";
import { ClaudeCodeAdapter } from "./ClaudeCodeAdapter";
import { OpenCodeAdapter } from "./OpenCodeAdapter";
import { CodexAdapter } from "./CodexAdapter";
import { WorkspaceManager } from "./WorkspaceManager";
import { AgentAuditLog } from "./AgentAuditLog";
import {
  normalizePermissionMode,
  requiresExplicitConfirmation,
  APPROVAL_TOOL_NAME,
} from "./PermissionEngine";
import { MeetingMCPServer, MEETING_MCP_PORT } from "../MeetingMCPServer";
import { AcpAgentConnection, AcpPermissionRequest } from "./acp/AcpAgentConnection";
import { AgentRegistry, ExternalAgentSpec } from "./AgentRegistry";

export interface OrchestratorRunInput {
  prompt: string;
  systemPrompt?: string;
  /** Builtin provider id or a custom external-agent id. */
  provider?: string;
  model?: string;
  meetingId?: string;
  meetingTitle?: string;
  signal?: AbortSignal;
  /** Screenshot/image paths for multimodal turns. */
  imagePaths?: string[];
  /** Provider env vars (openclaude backend) resolved by the caller. */
  providerEnv?: Record<string, string>;
  /** Tool agency: "plain" (LLM only) or "agentic" (tools/MCP). Default agentic. */
  toolMode?: "plain" | "agentic";
  /** UI approval bridge for permission asks (ACP + claude prompt tool). */
  onPermissionRequest?: (
    req: AcpPermissionRequest,
  ) => Promise<{ allow: boolean }>;
}

export function buildAdapter(provider: AgentProvider): AgentAdapter {
  switch (provider) {
    case "claude":
    case "openclaude":
      return new ClaudeCodeAdapter(provider);
    case "opencode":
      return new OpenCodeAdapter();
    case "codex":
      return new CodexAdapter();
    default:
      return new ClaudeCodeAdapter("openclaude");
  }
}

/** Push→pull bridge: ACP events arrive via callback, generators pull them. */
class EventQueue {
  private items: AgentEvent[] = [];
  private waiter: (() => void) | null = null;
  private done = false;

  push(event: AgentEvent): void {
    this.items.push(event);
    this.waiter?.();
    this.waiter = null;
  }
  finish(): void {
    this.done = true;
    this.waiter?.();
    this.waiter = null;
  }
  async next(): Promise<AgentEvent | null> {
    while (true) {
      const item = this.items.shift();
      if (item) return item;
      if (this.done) return null;
      await new Promise<void>((resolve) => { this.waiter = resolve; });
    }
  }
}

export class AgentOrchestrator {
  private static instance: AgentOrchestrator | null = null;

  private currentProcess: ChildProcess | null = null;
  private tempMcpConfig: string | null = null;
  /** meetingId → CLI session id, for multi-turn continuity (legacy transports). */
  private readonly sessionByMeeting = new Map<string, string>();
  /** Persistent ACP connections, keyed by `${agentId}::${workspaceDir}`. */
  private readonly acpConnections = new Map<
    string,
    { conn: AcpAgentConnection; queue: EventQueue | null }
  >();
  private activeAcpConn: AcpAgentConnection | null = null;

  static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  /**
   * Catalog of external agents (builtin + custom) with availability resolved.
   * Mirrors Zed's agent picker: name, transport, and whether it's installed.
   */
  listExternalAgents(settings: AgentCliSettings = {}): ExternalAgentSpec[] {
    return AgentRegistry.list(settings as any);
  }

  /** Back-compat shape used by the original IPC contract. */
  detectAvailableProviders(
    settings: AgentCliSettings = {},
  ): { provider: string; path: string }[] {
    return this.listExternalAgents(settings)
      .filter((a) => a.available && a.command)
      .map((a) => ({ provider: a.id, path: a.command! }));
  }

  private resolveExecutable(
    provider: AgentProvider,
    configured?: string,
  ): string | null {
    if (configured && configured.trim()) {
      // Explicit absolute/relative path that exists wins outright.
      if (fs.existsSync(configured)) return configured;
      // Bare command (relies on PATH) — accept as-is; spawn will validate.
      if (!configured.includes(path.sep)) return configured;
    }
    const adapter = buildAdapter(provider);
    for (const candidate of adapter.defaultPaths()) {
      if (candidate.includes(path.sep)) {
        if (fs.existsSync(candidate)) return candidate;
      } else {
        // Bare fallback (e.g. "claude") — only used if nothing concrete found.
        // Defer to PATH resolution at spawn time; keep as last resort.
      }
    }
    // No concrete file; fall back to the last bare candidate so PATH can work.
    const bare = adapter.defaultPaths().find((c) => !c.includes(path.sep));
    return configured?.trim() || bare || null;
  }

  cancel(): void {
    if (this.currentProcess && !this.currentProcess.killed) {
      try {
        this.currentProcess.kill("SIGTERM");
      } catch {}
    }
    this.currentProcess = null;
    // ACP turns are cancelled in-session; the connection stays alive for the
    // next turn (that's the whole point of the persistent transport).
    this.activeAcpConn?.cancel();
    this.cleanupTempMcp();
  }

  /** Tear down every persistent ACP agent process (app quit / meeting end). */
  disposeAcpConnections(): void {
    for (const [, entry] of this.acpConnections) entry.conn.dispose();
    this.acpConnections.clear();
    this.activeAcpConn = null;
  }

  private cleanupTempMcp(): void {
    if (this.tempMcpConfig) {
      try { fs.unlinkSync(this.tempMcpConfig); } catch {}
      this.tempMcpConfig = null;
    }
  }

  private writeClaudeMcpConfig(): string {
    const file = path.join(os.tmpdir(), `momor-agent-mcp-${Date.now()}.json`);
    const config = MeetingMCPServer.getInstance().getMcpConfigJson() as {
      mcpServers: Record<string, any>;
    };
    // Merge user-configured MCP servers (from the sidebar) alongside the meeting server.
    try {
      const { DatabaseManager } = require("../../db/DatabaseManager");
      const userServers = DatabaseManager.getInstance().getEnabledMcpServersConfig();
      config.mcpServers = { ...config.mcpServers, ...userServers };
    } catch (e: any) {
      console.warn("[AgentOrchestrator] merge user MCP servers failed:", e?.message);
    }
    fs.writeFileSync(file, JSON.stringify(config, null, 2), "utf8");
    this.tempMcpConfig = file;
    return file;
  }

  /** Build an "Available skills" block from enabled skills for the system prompt. */
  private buildSkillsSystemBlock(): string {
    try {
      const { DatabaseManager } = require("../../db/DatabaseManager");
      const skills = DatabaseManager.getInstance().getEnabledSkills();
      if (!skills.length) return "";
      const parts = skills.map(
        (s: any) =>
          `## ${s.name}\n${s.description ? s.description + "\n\n" : ""}${s.content}`,
      );
      return (
        "# Available skills\n" +
        "You have the following user-defined skills. When a request matches a skill's " +
        "description, follow that skill's instructions.\n\n" +
        parts.join("\n\n")
      );
    } catch {
      return "";
    }
  }

  async *run(
    input: OrchestratorRunInput,
    settings: AgentCliSettings = {},
  ): AsyncGenerator<AgentEvent> {
    // Stop any prior run.
    this.cancel();

    // Inject enabled skills into free-form agentic turns only. Structured/plain
    // turns stay lean, and callers that already appended a skills block won't
    // get it duplicated here.
    const skillsBlock =
      input.toolMode === "plain" ||
      input.systemPrompt?.includes("# Available skills")
        ? ""
        : this.buildSkillsSystemBlock();
    const effectiveSystemPrompt =
      [input.systemPrompt, skillsBlock].filter(Boolean).join("\n\n---\n\n") ||
      undefined;
    input = { ...input, systemPrompt: effectiveSystemPrompt };

    const agentId = input.provider ?? settings.provider ?? "openclaude";
    const permissionMode = normalizePermissionMode(
      settings.permissionMode ?? "auto-edit",
    );
    const audit = AgentAuditLog.getInstance();

    let workspaceDir: string;
    try {
      workspaceDir = WorkspaceManager.getInstance().resolveWorkspace(settings, {
        id: input.meetingId,
        title: input.meetingTitle,
      });
    } catch (err: any) {
      yield { type: "error", error: err?.message ?? "Workspace error" };
      return;
    }

    // Zed-style transport selection: ACP agents get a persistent session;
    // the rest go through the verified one-shot adapters below.
    const agentSpec = AgentRegistry.find(agentId, settings as any);
    if (agentSpec?.transport === "acp") {
      yield* this.runAcpTurn(agentSpec, input, settings, workspaceDir, permissionMode);
      return;
    }

    const provider = agentId as AgentProvider;
    const adapter = buildAdapter(provider);

    if (provider === "openclaude") {
      try {
        const { OpenClaudeManager } = require("../../openclaude/OpenClaudeManager");
        const status = await OpenClaudeManager.getInstance().ensureInstalled();
        if (!status.installed) {
          yield {
            type: "error",
            error:
              "OpenClaude is not installed and automatic installation failed.",
          };
          return;
        }
      } catch (err: any) {
        yield {
          type: "error",
          error: `OpenClaude install failed: ${err?.message ?? "unknown error"}`,
        };
        return;
      }
    }

    const executablePath = this.resolveExecutable(
      provider,
      settings.executablePaths?.[provider],
    );
    if (!executablePath) {
      yield {
        type: "error",
        error: `No executable found for ${provider}. Configure its path in Settings → Agents.`,
      };
      return;
    }

    // No hardcoded fallback: an empty model means "use the CLI's own
    // configured default" — exactly like running it in a terminal. The user's
    // CLI may be wired to DeepSeek, a local model, or a ChatGPT account; forcing
    // a model they have no key for makes the agent fail silently.
    const model = input.model || settings.model || "";

    // MCP injection per provider capability. Skipped in plain mode — a raw-LLM
    // turn (meeting assist) has no tools, so there's nothing to wire.
    let mcpConfigPath: string | undefined;
    if (adapter.capabilities.mcp === "flag" && input.toolMode !== "plain") {
      mcpConfigPath = this.writeClaudeMcpConfig();
    } else if (adapter.capabilities.mcp === "config-file") {
      const mcpUrl = `http://127.0.0.1:${MEETING_MCP_PORT}/sse`;
      const perm = OpenCodeAdapter.permissionConfigFor({
        executablePath,
        model,
        workspaceDir,
        permissionMode,
      });
      try {
        OpenCodeAdapter.prepareWorkspaceConfig(workspaceDir, mcpUrl, perm);
      } catch (err: any) {
        console.warn("[AgentOrchestrator] opencode.json write failed:", err?.message);
      }
    }

    const ctx: AdapterContext = {
      executablePath,
      model,
      workspaceDir,
      permissionMode,
      mcpConfigPath,
      providerEnv: input.providerEnv,
      toolMode: input.toolMode,
      approvalToolName:
        settings.approvalsEnabled !== false && adapter.capabilities.finePermissionPrompt
          ? APPROVAL_TOOL_NAME
          : undefined,
    };

    const runOptions: AgentRunOptions = {
      prompt: input.prompt,
      systemPrompt: input.systemPrompt,
      model,
      meetingId: input.meetingId,
      imagePaths: input.imagePaths,
      cliSessionId: input.meetingId
        ? this.sessionByMeeting.get(input.meetingId)
        : undefined,
      signal: input.signal,
    };

    const spec = adapter.buildSpawn(runOptions, ctx);
    audit.record({
      ts: Date.now(),
      meetingId: input.meetingId,
      provider,
      kind: "run_start",
      detail: {
        workspaceDir,
        permissionMode,
        model,
        fullAccess: requiresExplicitConfirmation(permissionMode),
        resume: Boolean(runOptions.cliSessionId),
      },
    });

    const proc = spawn(spec.cmd, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: spec.useShell,
    });
    this.currentProcess = proc;

    const onAbort = () => this.cancel();
    input.signal?.addEventListener("abort", onAbort, { once: true });

    // Feed the prompt via stdin, then close it.
    try {
      proc.stdin?.write(spec.stdinPrompt);
      proc.stdin?.end();
    } catch {
      // stdin errors surface via the 'error'/close path below
    }

    // Line-buffered stdout → adapter.parseLine → normalized events.
    const state = createParseState();
    let stdoutBuf = "";
    let stderrTail = "";
    let emittedDone = false;

    const lines: string[] = [];
    const waiters: Array<() => void> = [];
    let closed = false;
    let spawnError: Error | null = null;

    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk: string) => {
      stdoutBuf += chunk;
      const parts = stdoutBuf.split("\n");
      stdoutBuf = parts.pop() ?? "";
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          lines.push(trimmed);
          waiters.shift()?.();
        }
      }
    });
    proc.stderr?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-800);
    });
    proc.on("error", (err) => {
      spawnError = err;
      waiters.shift()?.();
    });
    proc.on("close", () => {
      if (stdoutBuf.trim()) lines.push(stdoutBuf.trim());
      closed = true;
      waiters.shift()?.();
    });

    const nextLine = (): Promise<string | null> =>
      new Promise((resolve) => {
        if (lines.length) return resolve(lines.shift()!);
        if (spawnError || closed) return resolve(null);
        waiters.push(() => resolve(lines.shift() ?? null));
      });

    try {
      while (true) {
        if (input.signal?.aborted) break;
        const line = await nextLine();
        if (line === null) break;

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // non-JSON log noise
        }

        for (const event of adapter.parseLine(parsed, state)) {
          if (event.type === "session" && event.sessionId && input.meetingId) {
            this.sessionByMeeting.set(input.meetingId, event.sessionId);
          }
          if (event.type === "tool_call") {
            audit.record({
              ts: Date.now(),
              meetingId: input.meetingId,
              provider,
              kind: "tool_call",
              detail: { name: event.toolName, args: event.toolArgs },
            });
          }
          if (event.type === "done") emittedDone = true;
          if (event.type === "token" && event.text) state.fullText += event.text;
          yield event;
        }
      }
    } finally {
      input.signal?.removeEventListener("abort", onAbort);
      this.currentProcess = null;
      this.cleanupTempMcp();
      if (!proc.killed) {
        try { proc.kill("SIGTERM"); } catch {}
      }
    }

    if (spawnError) {
      audit.record({
        ts: Date.now(),
        meetingId: input.meetingId,
        provider,
        kind: "run_error",
        detail: { error: spawnError.message },
      });
      yield {
        type: "error",
        error: `Failed to launch ${provider}: ${spawnError.message}`,
      };
      return;
    }

    if (!emittedDone) {
      // Process ended without a terminal event (e.g. opencode json, or a crash).
      if (input.signal?.aborted) return;
      if (state.fullText.trim()) {
        audit.record({ ts: Date.now(), meetingId: input.meetingId, provider, kind: "run_end" });
        yield { type: "done", fullText: state.fullText, sessionId: state.sessionId };
      } else {
        const detail = stderrTail.trim();
        audit.record({
          ts: Date.now(),
          meetingId: input.meetingId,
          provider,
          kind: "run_error",
          detail: { error: detail || "empty output" },
        });
        yield {
          type: "error",
          error: detail
            ? `${provider} exited: ${detail.slice(0, 300)}`
            : `${provider} produced no output.`,
        };
      }
    } else {
      audit.record({ ts: Date.now(), meetingId: input.meetingId, provider, kind: "run_end" });
    }
  }

  /**
   * One turn against a persistent ACP agent (Zed's external-agent model).
   * The agent process and its session survive across turns — real multi-turn —
   * and file edits flow through our fs bridge with workspace enforcement.
   */
  private async *runAcpTurn(
    spec: ExternalAgentSpec,
    input: OrchestratorRunInput,
    settings: AgentCliSettings,
    workspaceDir: string,
    permissionMode: ReturnType<typeof normalizePermissionMode>,
  ): AsyncGenerator<AgentEvent> {
    const audit = AgentAuditLog.getInstance();
    if (!spec.command) {
      yield {
        type: "error",
        error: `No executable found for ${spec.name}. Configure its path in Settings → Agents.`,
      };
      return;
    }

    // opencode reads project config from cwd: plant the meeting MCP server and
    // permission rules in <workspace>/opencode.json before the agent boots.
    if (spec.id === "opencode") {
      try {
        OpenCodeAdapter.prepareWorkspaceConfig(
          workspaceDir,
          `http://127.0.0.1:${MEETING_MCP_PORT}/sse`,
          OpenCodeAdapter.permissionConfigFor({
            executablePath: spec.command,
            model: input.model || settings.model || "",
            workspaceDir,
            permissionMode,
          }),
        );
      } catch (err: any) {
        console.warn("[AgentOrchestrator] opencode.json write failed:", err?.message);
      }
    }

    const key = `${spec.id}::${workspaceDir}`;
    let entry = this.acpConnections.get(key);

    if (!entry || !entry.conn.alive) {
      entry?.conn.dispose();
      const newEntry: { conn: AcpAgentConnection; queue: EventQueue | null } = {
        conn: null as unknown as AcpAgentConnection,
        queue: null,
      };
      try {
        newEntry.conn = await AcpAgentConnection.connect(
          {
            cmd: spec.command,
            args: spec.args ?? [],
            env: { ...process.env, ...(spec.env ?? {}) },
            cwd: workspaceDir,
          },
          {
            permissionMode,
            workspaceDir,
            requestUserPermission: input.onPermissionRequest,
            onEvent: (event) => newEntry.queue?.push(event),
          },
        );
        await newEntry.conn.newSession(
          `http://127.0.0.1:${MEETING_MCP_PORT}/sse`,
        );
      } catch (err: any) {
        audit.record({
          ts: Date.now(),
          meetingId: input.meetingId,
          provider: spec.id,
          kind: "run_error",
          detail: { error: err?.message, transport: "acp" },
        });
        yield {
          type: "error",
          error: `Failed to start ${spec.name} (ACP): ${err?.message}`,
        };
        return;
      }
      this.acpConnections.set(key, newEntry);
      entry = newEntry;
    }

    const queue = new EventQueue();
    entry.queue = queue;
    this.activeAcpConn = entry.conn;

    audit.record({
      ts: Date.now(),
      meetingId: input.meetingId,
      provider: spec.id,
      kind: "run_start",
      detail: { workspaceDir, permissionMode, transport: "acp" },
    });

    const onAbort = () => entry!.conn.cancel();
    input.signal?.addEventListener("abort", onAbort, { once: true });

    // ACP has no separate system-prompt channel; fold context into the turn.
    const text = input.systemPrompt
      ? `<context>\n${input.systemPrompt}\n</context>\n\n${input.prompt}`
      : input.prompt;

    let fullText = "";
    let promptError: string | null = null;
    const promptPromise = entry.conn
      .prompt(text)
      .catch((err: any) => {
        promptError = err?.message ?? "ACP prompt failed";
      })
      .finally(() => queue.finish());

    try {
      while (true) {
        const event = await queue.next();
        if (event === null) break;
        if (event.type === "token" && event.text) fullText += event.text;
        if (event.type === "tool_call") {
          audit.record({
            ts: Date.now(),
            meetingId: input.meetingId,
            provider: spec.id,
            kind: "tool_call",
            detail: { name: event.toolName, args: event.toolArgs },
          });
        }
        yield event;
      }
    } finally {
      input.signal?.removeEventListener("abort", onAbort);
      entry.queue = null;
      this.activeAcpConn = null;
    }

    await promptPromise;
    if (promptError) {
      audit.record({
        ts: Date.now(),
        meetingId: input.meetingId,
        provider: spec.id,
        kind: "run_error",
        detail: { error: promptError, transport: "acp" },
      });
      yield { type: "error", error: promptError };
      return;
    }

    audit.record({ ts: Date.now(), meetingId: input.meetingId, provider: spec.id, kind: "run_end" });
    yield {
      type: "done",
      fullText,
      sessionId: undefined,
    };
  }

  /** Forget multi-turn continuity for a meeting (e.g. on meeting end). */
  resetMeeting(meetingId: string): void {
    this.sessionByMeeting.delete(meetingId);
  }
}
