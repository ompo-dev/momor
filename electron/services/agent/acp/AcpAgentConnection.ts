/**
 * AcpAgentConnection — Zed-style external agent session over ACP.
 *
 * Lifecycle: spawn agent process → initialize (advertise fs capabilities) →
 * session/new (cwd + meeting MCP server when supported) → session/prompt per
 * turn (session/update notifications stream back) → session/cancel / dispose.
 *
 * The HOST implements the agent's callbacks, which is what makes file edits
 * actually work and stay safe:
 *   fs/read_text_file  / fs/write_text_file — gated by the workspace allowlist
 *   session/request_permission              — resolved by PermissionEngine
 *                                             policy or bubbled to the UI
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { AcpClient, AcpError } from "./AcpClient";
import { AgentEvent, AgentPermissionMode } from "../types";
import { WorkspaceManager } from "../WorkspaceManager";

export const ACP_PROTOCOL_VERSION = 1;

export interface AcpSpawnSpec {
  cmd: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}

export interface AcpPermissionRequest {
  tool: string;
  input: Record<string, unknown>;
  /** ACP option ids offered by the agent, when present. */
  options?: Array<{ optionId: string; name: string; kind: string }>;
}

export interface AcpConnectionCallbacks {
  permissionMode: AgentPermissionMode;
  workspaceDir: string;
  /** UI approval fallback; absent → deny. */
  requestUserPermission?: (
    req: AcpPermissionRequest,
  ) => Promise<{ allow: boolean }>;
  onEvent: (event: AgentEvent) => void;
}

interface ToolCallState {
  title: string;
  output: string;
}

function contentBlockText(block: any): string {
  if (!block) return "";
  if (typeof block === "string") return block;
  if (block.type === "text" && typeof block.text === "string") return block.text;
  return "";
}

export class AcpAgentConnection {
  private client: AcpClient;
  private sessionId: string | null = null;
  private agentCapabilities: any = {};
  private toolCalls = new Map<string, ToolCallState>();
  private callbacks: AcpConnectionCallbacks;
  private promptActive = false;

  private constructor(client: AcpClient, callbacks: AcpConnectionCallbacks) {
    this.client = client;
    this.callbacks = callbacks;
    client.onNotification = (method, params) => {
      if (method === "session/update") this.handleSessionUpdate(params);
    };
    client.onRequest = (req) => this.handleAgentRequest(req.method, req.params);
  }

  static async connect(
    spec: AcpSpawnSpec,
    callbacks: AcpConnectionCallbacks,
  ): Promise<AcpAgentConnection> {
    const proc = spawn(spec.cmd, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell:
        process.platform === "win32" && /\.(cmd|bat)$/i.test(spec.cmd),
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      console.warn("[ACP:agent]", chunk.toString().slice(0, 300));
    });

    const client = new AcpClient(proc);
    const conn = new AcpAgentConnection(client, callbacks);

    const init = await client.request("initialize", {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: false,
      },
    });
    conn.agentCapabilities = init?.agentCapabilities ?? {};
    return conn;
  }

  /** Whether the agent accepts HTTP/SSE MCP servers in session/new. */
  private supportsRemoteMcp(): boolean {
    const mcp = this.agentCapabilities?.mcpCapabilities;
    return Boolean(mcp?.sse || mcp?.http);
  }

  async newSession(meetingMcpUrl?: string): Promise<string> {
    const mcpServers: any[] = [];
    if (meetingMcpUrl && this.supportsRemoteMcp()) {
      mcpServers.push({
        type: this.agentCapabilities?.mcpCapabilities?.sse ? "sse" : "http",
        name: "momor-meeting",
        url: meetingMcpUrl,
      });
    }
    const result = await this.client.request("session/new", {
      cwd: this.callbacks.workspaceDir,
      mcpServers,
    });
    this.sessionId = result?.sessionId;
    if (!this.sessionId) throw new Error("ACP agent returned no sessionId");
    return this.sessionId;
  }

  /** Send one turn; events stream via callbacks.onEvent; resolves on stop. */
  async prompt(text: string): Promise<{ stopReason: string }> {
    if (!this.sessionId) throw new Error("No ACP session — call newSession first");
    this.promptActive = true;
    try {
      const result = await this.client.request(
        "session/prompt",
        {
          sessionId: this.sessionId,
          prompt: [{ type: "text", text }],
        },
        600_000,
      );
      return { stopReason: result?.stopReason ?? "end_turn" };
    } finally {
      this.promptActive = false;
    }
  }

  cancel(): void {
    if (this.sessionId && this.promptActive) {
      this.client.notify("session/cancel", { sessionId: this.sessionId });
    }
  }

  dispose(): void {
    this.client.dispose();
  }

  get alive(): boolean {
    return this.client.alive;
  }

  // ───────────────────────── agent → client ─────────────────────────

  private handleSessionUpdate(params: any): void {
    const update = params?.update;
    if (!update) return;
    const emit = this.callbacks.onEvent;

    switch (update.sessionUpdate) {
      case "agent_message_chunk": {
        const text = contentBlockText(update.content);
        if (text) emit({ type: "token", text });
        break;
      }
      case "agent_thought_chunk": {
        const text = contentBlockText(update.content);
        if (text) emit({ type: "thinking", text });
        break;
      }
      case "tool_call": {
        const id = String(update.toolCallId ?? `acp-${Date.now()}`);
        this.toolCalls.set(id, { title: update.title ?? update.kind ?? "tool", output: "" });
        emit({
          type: "tool_call",
          toolId: id,
          toolName: update.title || update.kind || "tool",
          toolArgs: (update.rawInput as Record<string, unknown>) ?? {},
        });
        break;
      }
      case "tool_call_update": {
        const id = String(update.toolCallId ?? "");
        const state = this.toolCalls.get(id);
        const pieces: string[] = [];
        for (const item of update.content ?? []) {
          if (item?.type === "content") {
            const t = contentBlockText(item.content);
            if (t) pieces.push(t);
          } else if (item?.type === "diff") {
            pieces.push(`[diff] ${item.path ?? ""}`);
          }
        }
        if (state && pieces.length) state.output += pieces.join("\n");
        if (update.status === "completed" || update.status === "failed") {
          emit({
            type: "tool_result",
            toolId: id,
            toolResult:
              (state?.output || pieces.join("\n") || update.status) ?? "",
            toolIsError: update.status === "failed",
          });
          this.toolCalls.delete(id);
        }
        break;
      }
      default:
        break; // plan / available_commands_update / mode updates — not surfaced yet
    }
  }

  private async handleAgentRequest(method: string, params: any): Promise<any> {
    switch (method) {
      case "fs/read_text_file": {
        const target = String(params?.path ?? "");
        // Reads outside the workspace are fine for context, but never secrets dirs.
        const resolved = path.resolve(target);
        const lower = resolved.toLowerCase();
        if (/[\\/](\.ssh|\.gnupg|\.aws)([\\/]|$)/.test(lower)) {
          throw new AcpError(-32000, "Read blocked: sensitive directory");
        }
        let content = fs.readFileSync(resolved, "utf8");
        if (typeof params?.line === "number" || typeof params?.limit === "number") {
          const lines = content.split("\n");
          const start = Math.max(0, (params.line ?? 1) - 1);
          const count = params.limit ?? lines.length;
          content = lines.slice(start, start + count).join("\n");
        }
        return { content };
      }

      case "fs/write_text_file": {
        if (this.callbacks.permissionMode === "read-only") {
          throw new AcpError(-32000, "Write blocked: agent is in read-only mode");
        }
        const target = String(params?.path ?? "");
        const ws = this.callbacks.workspaceDir;
        const inWorkspace = WorkspaceManager.getInstance().containsPath(ws, target);
        if (!inWorkspace && this.callbacks.permissionMode !== "full-access") {
          // auto-edit: outside-workspace writes need explicit user approval.
          const decision = await this.askUser({
            tool: "write_file",
            input: { path: target },
          });
          if (!decision.allow) {
            throw new AcpError(-32000, `Write outside workspace denied: ${target}`);
          }
        }
        const resolved = path.resolve(ws, target);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, String(params?.content ?? ""), "utf8");
        return null;
      }

      case "session/request_permission": {
        const options: Array<{ optionId: string; name: string; kind: string }> =
          params?.options ?? [];
        const allowOption =
          options.find((o) => o.kind === "allow_once") ??
          options.find((o) => o.kind === "allow_always");
        const rejectOption =
          options.find((o) => o.kind === "reject_once") ??
          options.find((o) => o.kind === "reject_always");

        const toolCall = params?.toolCall ?? {};
        const kind = String(toolCall.kind ?? "other");
        const mode = this.callbacks.permissionMode;

        let allow: boolean;
        if (mode === "full-access") {
          allow = true;
        } else if (mode === "read-only") {
          // Reads/searches fine; anything mutating is rejected outright.
          allow = kind === "read" || kind === "search" || kind === "fetch" || kind === "think";
        } else {
          // auto-edit: edits inside the workspace auto-allow; everything else
          // (execute, delete, outside-workspace) asks the user.
          const locations: string[] = (toolCall.locations ?? [])
            .map((l: any) => String(l?.path ?? ""))
            .filter(Boolean);
          const ws = this.callbacks.workspaceDir;
          const allInWorkspace =
            locations.length > 0 &&
            locations.every((p) =>
              WorkspaceManager.getInstance().containsPath(ws, p),
            );
          if (kind === "edit" && allInWorkspace) {
            allow = true;
          } else if (kind === "read" || kind === "search" || kind === "fetch" || kind === "think") {
            allow = true;
          } else {
            allow = (
              await this.askUser({
                tool: toolCall.title || kind,
                input: (toolCall.rawInput as Record<string, unknown>) ?? {},
                options,
              })
            ).allow;
          }
        }

        if (allow && allowOption) {
          return { outcome: { outcome: "selected", optionId: allowOption.optionId } };
        }
        if (!allow && rejectOption) {
          return { outcome: { outcome: "selected", optionId: rejectOption.optionId } };
        }
        return { outcome: { outcome: "cancelled" } };
      }

      default:
        throw new AcpError(-32601, `Client method not implemented: ${method}`);
    }
  }

  private askUser(
    req: AcpPermissionRequest,
  ): Promise<{ allow: boolean }> {
    if (!this.callbacks.requestUserPermission) {
      return Promise.resolve({ allow: false });
    }
    return this.callbacks.requestUserPermission(req);
  }
}
