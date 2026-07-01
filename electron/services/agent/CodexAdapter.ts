/**
 * CodexAdapter — drives `codex exec --json`, reusing the battle-tested arg
 * builder and config repair from CodexCliService.
 *
 * Invocation:  codex exec [resume <threadId>] --json --color never
 *   --sandbox <mode> --skip-git-repo-check --model <m> [--image <p>]...
 * Prompt goes to stdin. cwd = workspace (sandbox workspace-write scopes to it).
 *
 * codex exec has no MCP-config flag, so meeting context is folded into the
 * prompt by the orchestrator instead of exposed as tools.
 *
 * JSON events:
 *   {type:"thread.started",thread_id}                  → session
 *   {type:"item.started"/"item.updated"/"item.completed", item:{...}}
 *     item type agent_message  → token (on completed)
 *     item type reasoning      → thinking (on completed)
 *     item type command_execution → tool_call (started) / tool_result (completed)
 *     item type file_change    → tool_call + tool_result (completed)
 *     item type mcp_tool_call  → tool_call / tool_result
 *     item type error          → error
 *   {type:"turn.completed"}                            → done
 *   {type:"turn.failed"} / {type:"error"}              → error
 * Item shape uses `item_type` or `type` depending on version — both handled.
 */

import {
  AgentAdapter,
  AgentEvent,
  AgentRunOptions,
  AdapterContext,
  AgentSpawnSpec,
  ParseState,
} from "./types";
import { CodexCliService } from "../CodexCliService";
import { sandboxForCodex } from "./PermissionEngine";

function itemType(item: any): string {
  return String(item?.item_type ?? item?.type ?? "");
}

function itemId(item: any): string {
  return String(item?.id ?? `codex-${Date.now()}`);
}

export class CodexAdapter implements AgentAdapter {
  readonly provider = "codex" as const;
  readonly capabilities = {
    mcp: "none" as const,
    resume: true,
    finePermissionPrompt: false,
  };

  defaultPaths(): string[] {
    // CodexCliService already maintains the per-platform install candidates.
    return [...CodexCliService.getCandidatePaths(), "codex"];
  }

  buildSpawn(options: AgentRunOptions, ctx: AdapterContext): AgentSpawnSpec {
    CodexCliService.ensureCodexConfig();

    const sandbox = sandboxForCodex(ctx.permissionMode);
    const args = CodexCliService.buildArgs(
      options.model || ctx.model,
      options.imagePaths ?? [],
      sandbox,
    );
    // Zed-style model handling: when the user picked no explicit model, strip
    // --model so codex uses its own config.toml default.
    if (!(options.model || ctx.model)) {
      const i = args.indexOf("--model");
      if (i !== -1) args.splice(i, 2);
    }
    // buildArgs => ["exec", "--json", ...]; resume slots in as a subcommand.
    if (options.cliSessionId) {
      args.splice(1, 0, "resume", options.cliSessionId);
    }

    // No MCP tools — meeting context rides in the prompt itself.
    const stdinPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n---\n\n${options.prompt}`
      : options.prompt;

    return {
      cmd: ctx.executablePath,
      args,
      stdinPrompt,
      cwd: ctx.workspaceDir,
      env: { ...process.env },
      // CodexCliService spawns with shell on win32 (codex.cmd shim support).
      useShell: process.platform === "win32",
    };
  }

  parseLine(json: unknown, state: ParseState): AgentEvent[] {
    const parsed = json as any;
    if (!parsed || typeof parsed !== "object") return [];
    const events: AgentEvent[] = [];

    if (parsed.type === "thread.started") {
      const id = parsed.thread_id ?? parsed.threadId;
      if (typeof id === "string" && id) {
        state.sessionId = id;
        events.push({ type: "session", sessionId: id });
      }
      return events;
    }

    if (parsed.type === "turn.completed") {
      events.push({ type: "done", sessionId: state.sessionId });
      return events;
    }

    if (parsed.type === "turn.failed" || parsed.type === "error") {
      const message =
        CodexCliService.extractCodexError(JSON.stringify(parsed)) ||
        parsed.message ||
        "Codex error";
      events.push({ type: "error", error: String(message) });
      return events;
    }

    const item = parsed.item;
    if (!item || !/^item\./.test(String(parsed.type ?? ""))) return events;
    const kind = itemType(item);
    const id = itemId(item);
    const completed = parsed.type === "item.completed";

    switch (kind) {
      case "agent_message": {
        if (completed && item.text) events.push({ type: "token", text: item.text });
        break;
      }
      case "reasoning": {
        if (completed && item.text) events.push({ type: "thinking", text: item.text });
        break;
      }
      case "command_execution": {
        if (!state.announcedToolIds.has(id)) {
          state.announcedToolIds.add(id);
          events.push({
            type: "tool_call",
            toolId: id,
            toolName: "Bash",
            toolArgs: { command: item.command ?? "" },
          });
        }
        if (completed) {
          const exitCode = item.exit_code ?? item.exitCode;
          events.push({
            type: "tool_result",
            toolId: id,
            toolResult: String(item.aggregated_output ?? item.output ?? ""),
            toolIsError: typeof exitCode === "number" && exitCode !== 0,
          });
        }
        break;
      }
      case "file_change": {
        if (!state.announcedToolIds.has(id)) {
          state.announcedToolIds.add(id);
          events.push({
            type: "tool_call",
            toolId: id,
            toolName: "Write",
            toolArgs: { changes: item.changes ?? item.files ?? [] },
          });
        }
        if (completed) {
          events.push({
            type: "tool_result",
            toolId: id,
            toolResult: String(item.status ?? "completed"),
            toolIsError: item.status === "failed",
          });
        }
        break;
      }
      case "mcp_tool_call": {
        if (!state.announcedToolIds.has(id)) {
          state.announcedToolIds.add(id);
          events.push({
            type: "tool_call",
            toolId: id,
            toolName: `${item.server ?? "mcp"}.${item.tool ?? "tool"}`,
            toolArgs: (item.arguments as Record<string, unknown>) ?? {},
          });
        }
        if (completed) {
          events.push({
            type: "tool_result",
            toolId: id,
            toolResult: String(item.result ?? item.output ?? item.status ?? ""),
            toolIsError: item.status === "failed",
          });
        }
        break;
      }
      case "error": {
        events.push({
          type: "error",
          error: String(item.message ?? "Codex item error"),
        });
        break;
      }
      default:
        break;
    }

    return events;
  }
}
