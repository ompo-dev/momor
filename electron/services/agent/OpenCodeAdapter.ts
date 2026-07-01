/**
 * OpenCodeAdapter — drives `opencode run` (flags verified against
 * packages/opencode/src/cli/cmd/run.ts).
 *
 * Invocation:
 *   opencode run --format json [--model provider/model] [--session <id>]
 *     [--thinking] [--dangerously-skip-permissions]
 *
 * The message is sent via stdin (run appends stdin to the positional message,
 * and waits for stdin EOF — the orchestrator always closes stdin).
 *
 * MCP + permission rules cannot be passed as flags; they are merged into an
 * opencode.json in the workspace directory (cwd), which opencode picks up as
 * project config. See prepareWorkspaceConfig().
 *
 * JSON events (each line: {type, timestamp, sessionID, ...}):
 *   text       — completed text part      → token
 *   reasoning  — completed thinking part  → thinking (needs --thinking)
 *   tool_use   — completed/errored tool   → tool_call + tool_result
 *   step_start / step_finish              → ignored
 *   error                                 → error
 * Headless run auto-rejects permission asks unless --dangerously-skip-permissions.
 * There is no terminal "done" event in json mode — process exit means done.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  AgentAdapter,
  AgentEvent,
  AgentRunOptions,
  AdapterContext,
  AgentSpawnSpec,
  ParseState,
} from "./types";
import {
  permissionArgsForOpenCode,
  opencodePermissionConfig,
} from "./PermissionEngine";

export class OpenCodeAdapter implements AgentAdapter {
  readonly provider = "opencode" as const;
  readonly capabilities = {
    mcp: "config-file" as const,
    resume: true,
    finePermissionPrompt: false,
  };

  defaultPaths(): string[] {
    return [
      "C:\\Projects\\Teste\\opencode\\packages\\opencode\\bin\\opencode-windows-x64",
      path.join(os.homedir(), "AppData", "Roaming", "npm", "opencode.cmd"),
      path.join(os.homedir(), ".opencode", "bin", "opencode"),
      "opencode",
    ];
  }

  /**
   * Merge the meeting MCP server + permission rules into <workspace>/opencode.json.
   * Existing user config in that file is preserved (deep-merged per key);
   * we only own the "momor-meeting" MCP entry and the permission block we set.
   */
  static prepareWorkspaceConfig(
    workspaceDir: string,
    mcpUrl: string,
    permission: Record<string, string> | undefined,
  ): string {
    const configPath = path.join(workspaceDir, "opencode.json");
    let existing: Record<string, any> = {};
    try {
      if (fs.existsSync(configPath)) {
        existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
      }
    } catch {
      // Corrupt config — keep a backup and start clean rather than crash.
      try { fs.copyFileSync(configPath, configPath + ".bak"); } catch {}
      existing = {};
    }

    const merged = {
      ...existing,
      $schema: existing.$schema ?? "https://opencode.ai/config.json",
      mcp: {
        ...(existing.mcp ?? {}),
        "momor-meeting": { type: "remote", url: mcpUrl, enabled: true },
      },
      ...(permission
        ? { permission: { ...(existing.permission ?? {}), ...permission } }
        : {}),
    };

    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf8");
    return configPath;
  }

  buildSpawn(options: AgentRunOptions, ctx: AdapterContext): AgentSpawnSpec {
    const exePath = ctx.executablePath;
    const args: string[] = ["run", "--format", "json", "--thinking"];

    const model = options.model || ctx.model;
    if (model) args.push("--model", model);
    if (options.cliSessionId) args.push("--session", options.cliSessionId);
    args.push(...permissionArgsForOpenCode(ctx.permissionMode));

    // opencode has no --append-system-prompt in run; prepend it to the message.
    const stdinPrompt = options.systemPrompt
      ? `<system-context>\n${options.systemPrompt}\n</system-context>\n\n${options.prompt}`
      : options.prompt;

    const useShell =
      process.platform === "win32" &&
      (/\.(cmd|bat)$/i.test(exePath) || !exePath.includes(path.sep));

    return {
      cmd: exePath,
      args,
      stdinPrompt,
      cwd: ctx.workspaceDir,
      env: { ...process.env },
      useShell,
    };
  }

  /** Exposed so the orchestrator can write the config before spawning. */
  static permissionConfigFor(ctx: AdapterContext): Record<string, string> | undefined {
    return opencodePermissionConfig(ctx.permissionMode);
  }

  parseLine(json: unknown, state: ParseState): AgentEvent[] {
    const parsed = json as any;
    if (!parsed || typeof parsed !== "object") return [];
    const events: AgentEvent[] = [];

    if (typeof parsed.sessionID === "string" && parsed.sessionID && !state.sessionId) {
      state.sessionId = parsed.sessionID;
      events.push({ type: "session", sessionId: parsed.sessionID });
    }

    const part = parsed.part;
    const partId: string | undefined = part?.id;

    switch (parsed.type) {
      case "text": {
        if (!part?.text) break;
        if (partId && state.emittedPartIds.has(partId)) break;
        if (partId) state.emittedPartIds.add(partId);
        events.push({ type: "token", text: part.text });
        break;
      }
      case "reasoning": {
        if (!part?.text) break;
        if (partId && state.emittedPartIds.has(`r:${partId}`)) break;
        if (partId) state.emittedPartIds.add(`r:${partId}`);
        events.push({ type: "thinking", text: part.text });
        break;
      }
      case "tool_use": {
        // Emitted once per tool, on completion/error — synthesize call + result.
        const id = part?.callID || partId || `oc-${Date.now()}`;
        if (state.emittedPartIds.has(`t:${id}`)) break;
        state.emittedPartIds.add(`t:${id}`);
        const stateObj = part?.state ?? {};
        events.push({
          type: "tool_call",
          toolId: id,
          toolName: part?.tool ?? "tool",
          toolArgs: (stateObj.input as Record<string, unknown>) ?? {},
        });
        const isError = stateObj.status === "error";
        events.push({
          type: "tool_result",
          toolId: id,
          toolResult: isError
            ? String(stateObj.error ?? "Tool failed")
            : String(stateObj.output ?? stateObj.title ?? ""),
          toolIsError: isError,
        });
        break;
      }
      case "error": {
        const err = parsed.error;
        const message =
          err?.data?.message || err?.message || err?.name || "opencode error";
        events.push({ type: "error", error: String(message) });
        break;
      }
      default:
        break; // step_start / step_finish / unknown
    }

    return events;
  }
}
