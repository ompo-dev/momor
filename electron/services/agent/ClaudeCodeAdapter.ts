/**
 * ClaudeCodeAdapter — drives `claude` and `openclaude` (a Claude Code fork with
 * the same CLI surface; flag support verified against the bundled cli.mjs).
 *
 * Invocation:
 *   [node] cli.mjs --print --output-format stream-json --verbose
 *     --include-partial-messages --model <m> --mcp-config <tmp.json>
 *     [--resume <sessionId>] [permission flags]
 *
 * The prompt is written to stdin (claude -p reads stdin when no inline prompt
 * is given) so user text never goes through shell quoting.
 *
 * Stream-json events handled:
 *   {type:"system",subtype:"init",session_id}          → session
 *   {type:"stream_event",event:{content_block_delta}}  → token / thinking
 *   {type:"assistant",message:{content:[...]}}         → tool_use → tool_call;
 *       text blocks only when no deltas were seen (dedupe)
 *   {type:"user",message:{content:[{tool_result}]}}    → tool_result
 *   {type:"result",...}                                → done (cost, session)
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  AgentAdapter,
  AgentEvent,
  AgentProvider,
  AgentRunOptions,
  AdapterContext,
  AgentSpawnSpec,
  ParseState,
} from "./types";
import { permissionArgsForClaude } from "./PermissionEngine";

/**
 * Built-in Claude-Code tools blocked in "plain" mode so meeting-assist turns
 * behave like a raw LLM call (no filesystem/exec/agent loop) — fast, and the
 * output stays parseable structured text. Verified against the openclaude fork.
 */
const PLAIN_MODE_DISALLOWED_TOOLS =
  "Bash Edit Write Read Glob Grep WebFetch WebSearch NotebookEdit Task TodoWrite";

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (typeof c === "string" ? c : (c?.text ?? "")))
      .filter(Boolean)
      .join("\n");
  }
  return content == null ? "" : String(content);
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

function buildPromptWithSystemContext(
  prompt: string,
  systemPrompt?: string,
): string {
  if (!systemPrompt?.trim()) return prompt;
  return `<system-context>\n${systemPrompt.trim()}\n</system-context>\n\n${prompt}`;
}

function buildStructuredPrompt(
  prompt: string,
  imagePaths?: string[],
  systemPrompt?: string,
): string {
  const textPrompt = buildPromptWithSystemContext(prompt, systemPrompt);
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: textPrompt },
  ];

  for (const imagePath of imagePaths ?? []) {
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

  return (
    JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: content.length === 1 ? textPrompt : content,
      },
      parent_tool_use_id: null,
    }) + "\n"
  );
}

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly capabilities = {
    mcp: "flag" as const,
    resume: true,
    finePermissionPrompt: true,
  };

  constructor(readonly provider: Extract<AgentProvider, "claude" | "openclaude">) {}

  defaultPaths(): string[] {
    if (this.provider === "openclaude") {
      // Delegate to the manager (npm-global resolution + install-on-demand);
      // fall back to bare command if it can't resolve a concrete path.
      try {
        const { OpenClaudeManager } = require("../../openclaude/OpenClaudeManager");
        const resolved = OpenClaudeManager.getInstance().resolvePath();
        return resolved ? [resolved] : ["openclaude"];
      } catch {
        return ["openclaude"];
      }
    }
    return [
      path.join(os.homedir(), ".local", "bin", "claude"),
      path.join(os.homedir(), "AppData", "Roaming", "npm", "claude.cmd"),
      "claude",
    ];
  }

  buildSpawn(options: AgentRunOptions, ctx: AdapterContext): AgentSpawnSpec {
    const exePath = ctx.executablePath;
    const isNodeScript = /\.(mjs|js|cjs)$/i.test(exePath);
    const cmd = isNodeScript ? process.execPath : exePath;
    const args: string[] = isNodeScript ? [exePath] : [];

    args.push(
      "--print",
      "--output-format", "stream-json",
      "--verbose",
      "--include-partial-messages",
    );
    const useStructuredInput = (options.imagePaths?.length ?? 0) > 0;
    if (useStructuredInput) {
      args.push("--input-format=stream-json");
    }

    // Zed-style model handling: the CLI runs with ITS OWN configured default
    // model (the user may have it pointed at DeepSeek, a local model, etc.).
    // Only pass --model when the user explicitly picked one for this agent.
    const model = options.model || ctx.model;
    if (model) args.push("--model", model);

    // Plain mode (meeting assist / tiny prompts): disable tools so openclaude
    // answers like a raw LLM — no MCP config, no agent loop.
    const plainMode = ctx.toolMode === "plain";
    if (ctx.mcpConfigPath && !plainMode) {
      args.push("--mcp-config", ctx.mcpConfigPath);
    }
    if (plainMode) {
      args.push("--disallowed-tools", PLAIN_MODE_DISALLOWED_TOOLS);
    }
    if (options.cliSessionId) {
      args.push("--resume", options.cliSessionId);
    }

    args.push(
      ...permissionArgsForClaude(ctx.permissionMode, ctx.approvalToolName),
    );

    // .cmd shims need a shell on Windows; node / direct binaries do not.
    const useShell =
      process.platform === "win32" && !isNodeScript && /\.(cmd|bat)$/i.test(exePath);

    // CRITICAL (Electron): process.execPath is the app binary, not node.
    // ELECTRON_RUN_AS_NODE makes Electron behave as plain Node for the child —
    // without it, launching cli.mjs would open another app instance and the
    // agent would silently "do nothing".
    // Provider selection for openclaude is driven purely by env vars (Anthropic
    // key / CLAUDE_CODE_USE_OPENAI + OpenAI-compat / Gemini). ctx.providerEnv is
    // resolved from the user's Momor integration settings and layered on top.
    const env: NodeJS.ProcessEnv = { ...process.env, ...(ctx.providerEnv ?? {}) };
    if (isNodeScript) env.ELECTRON_RUN_AS_NODE = "1";

    return {
      cmd,
      args,
      stdinPrompt: useStructuredInput
        ? buildStructuredPrompt(
            options.prompt,
            options.imagePaths,
            options.systemPrompt,
          )
        : buildPromptWithSystemContext(options.prompt, options.systemPrompt),
      cwd: ctx.workspaceDir,
      env,
      useShell,
    };
  }

  parseLine(json: unknown, state: ParseState): AgentEvent[] {
    const parsed = json as any;
    if (!parsed || typeof parsed !== "object") return [];
    const events: AgentEvent[] = [];

    // Session id from init.
    if (parsed.type === "system" && parsed.subtype === "init") {
      if (typeof parsed.session_id === "string" && parsed.session_id) {
        state.sessionId = parsed.session_id;
        events.push({ type: "session", sessionId: parsed.session_id });
      }
      return events;
    }

    // Fine-grained streaming (--include-partial-messages).
    if (parsed.type === "stream_event") {
      const ev = parsed.event;
      if (ev?.type === "content_block_delta") {
        const delta = ev.delta;
        if (delta?.type === "text_delta" && delta.text) {
          state.sawTextDelta = true;
          events.push({ type: "token", text: delta.text });
        } else if (delta?.type === "thinking_delta" && delta.thinking) {
          events.push({ type: "thinking", text: delta.thinking });
        }
      }
      return events;
    }

    // Complete assistant messages: tool calls always; text only if no deltas.
    if (parsed.type === "assistant" && Array.isArray(parsed.message?.content)) {
      for (const block of parsed.message.content) {
        if (block?.type === "tool_use") {
          events.push({
            type: "tool_call",
            toolId: block.id,
            toolName: block.name,
            toolArgs: block.input ?? {},
          });
        } else if (block?.type === "text" && block.text && !state.sawTextDelta) {
          events.push({ type: "token", text: block.text });
        } else if (block?.type === "thinking" && block.thinking && !state.sawTextDelta) {
          events.push({ type: "thinking", text: block.thinking });
        }
      }
      return events;
    }

    // Tool results arrive as user messages in stream-json (also accept the
    // bare tool_result shape some forks emit).
    if (parsed.type === "user" && Array.isArray(parsed.message?.content)) {
      for (const block of parsed.message.content) {
        if (block?.type === "tool_result") {
          events.push({
            type: "tool_result",
            toolId: block.tool_use_id,
            toolResult: contentToText(block.content),
            toolIsError: block.is_error === true,
          });
        }
      }
      return events;
    }
    if (parsed.type === "tool_result") {
      events.push({
        type: "tool_result",
        toolId: parsed.tool_use_id,
        toolResult: contentToText(parsed.content),
        toolIsError: parsed.is_error === true,
      });
      return events;
    }

    if (parsed.type === "result") {
      if (typeof parsed.session_id === "string" && parsed.session_id) {
        state.sessionId = parsed.session_id;
      }
      if (parsed.subtype && parsed.subtype !== "success") {
        events.push({
          type: "error",
          error:
            parsed.error || parsed.result || `Agent ended with ${parsed.subtype}`,
        });
      }
      events.push({
        type: "done",
        fullText: typeof parsed.result === "string" ? parsed.result : undefined,
        costUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : undefined,
        sessionId: state.sessionId,
      });
      return events;
    }

    return events;
  }
}
