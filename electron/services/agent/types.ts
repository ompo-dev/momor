/**
 * Shared types for the agent CLI integration layer.
 *
 * Every supported CLI (claude / openclaude / opencode / codex) is wrapped by an
 * AgentAdapter that knows that CLI's dialect: how to build the spawn args, how
 * to inject the meeting MCP server, and how to translate its JSON stream into
 * normalized AgentEvents. The AgentOrchestrator only ever speaks AgentEvent.
 */

export type AgentProvider = "claude" | "openclaude" | "opencode" | "codex";

export const AGENT_PROVIDERS: readonly AgentProvider[] = [
  "claude",
  "openclaude",
  "opencode",
  "codex",
];

/**
 * Unified permission modes, mapped per-provider by PermissionEngine:
 *   read-only   — agent may read/analyze but never write files or run commands
 *   auto-edit   — agent may write/edit inside the workspace; commands need approval
 *   full-access — everything allowed (requires explicit user confirmation)
 */
export type AgentPermissionMode = "read-only" | "auto-edit" | "full-access";

export const AGENT_PERMISSION_MODES: readonly AgentPermissionMode[] = [
  "read-only",
  "auto-edit",
  "full-access",
];

export type AgentEventType =
  | "token"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "session" // CLI session/thread id captured (for --resume / --session)
  | "done"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  // token / thinking
  text?: string;
  // tool_call
  toolId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  // tool_result
  toolResult?: string;
  toolIsError?: boolean;
  // session
  sessionId?: string;
  // done
  fullText?: string;
  costUsd?: number;
  // error
  error?: string;
}

export interface AgentRunOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  meetingId?: string;
  /** CLI-native session id from a previous turn (claude --resume / opencode --session / codex resume). */
  cliSessionId?: string;
  imagePaths?: string[];
  signal?: AbortSignal;
}

/** How much agency the CLI gets this turn. */
export type AgentToolMode =
  /** Plain LLM: tools disabled — fast, structured (meeting assist / tiny prompts). */
  | "plain"
  /** Full agent: tools/MCP/skills/filesystem active (free-form chat). */
  | "agentic";

/** Everything an adapter needs to build a spawn, resolved by the orchestrator. */
export interface AdapterContext {
  executablePath: string;
  model: string;
  workspaceDir: string;
  permissionMode: AgentPermissionMode;
  /** Path to the temp MCP config JSON (claude-style CLIs only). */
  mcpConfigPath?: string;
  /** Fully-qualified MCP tool name for fine-grained approval prompts, when enabled. */
  approvalToolName?: string;
  /** Provider env vars (openclaude backend selection) merged over process.env. */
  providerEnv?: Record<string, string>;
  /** Tool agency for this turn. Defaults to "agentic". */
  toolMode?: AgentToolMode;
}

export interface AgentSpawnSpec {
  cmd: string;
  args: string[];
  /** Prompt text written to stdin (always used — avoids shell-quoting user text). */
  stdinPrompt: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Spawn through a shell (needed for .cmd shims / bare commands on Windows). */
  useShell: boolean;
  /** Adapter-owned temp files that must be removed after the run finishes. */
  cleanupPaths?: string[];
}

/** Mutable per-run parse state so adapters can dedupe partials etc. */
export interface ParseState {
  /** claude: stream_event text deltas seen — skip duplicate full text blocks. */
  sawTextDelta: boolean;
  /** opencode: part ids already emitted (events can re-fire for the same part). */
  emittedPartIds: Set<string>;
  /** codex: item ids already announced as tool calls. */
  announcedToolIds: Set<string>;
  /** Accumulated assistant text (orchestrator-maintained). */
  fullText: string;
  /** CLI session id once captured. */
  sessionId?: string;
}

export function createParseState(): ParseState {
  return {
    sawTextDelta: false,
    emittedPartIds: new Set(),
    announcedToolIds: new Set(),
    fullText: "",
  };
}

export interface AgentAdapter {
  readonly provider: AgentProvider;
  readonly capabilities: {
    /** MCP injected via CLI flag (claude) vs. config file (opencode) vs. none (codex). */
    mcp: "flag" | "config-file" | "none";
    resume: boolean;
    finePermissionPrompt: boolean;
  };
  /** Default executable candidates checked when no path is configured. */
  defaultPaths(): string[];
  buildSpawn(options: AgentRunOptions, ctx: AdapterContext): AgentSpawnSpec;
  /** Translate one parsed JSON line into zero or more normalized events. */
  parseLine(json: unknown, state: ParseState): AgentEvent[];
}

export interface AgentCliSettings {
  /** Builtin provider id or custom external-agent id. */
  provider?: string;
  model?: string;
  executablePaths?: Partial<Record<AgentProvider, string>>;
  permissionMode?: AgentPermissionMode;
  workspaceStrategy?: "fixed" | "per-meeting" | "custom";
  customWorkspacePath?: string;
  /** Route unhandled permission prompts to an in-app approval modal (claude-style CLIs). */
  approvalsEnabled?: boolean;
  /** User-added ACP agents (Zed's "Add More Agents"): any command that speaks ACP. */
  customAgents?: Array<{
    id: string;
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

export const DEFAULT_AGENT_CLI_SETTINGS: Required<
  Pick<
    AgentCliSettings,
    "provider" | "permissionMode" | "workspaceStrategy" | "approvalsEnabled"
  >
> = {
  provider: "openclaude",
  permissionMode: "auto-edit",
  workspaceStrategy: "per-meeting",
  approvalsEnabled: true,
};
