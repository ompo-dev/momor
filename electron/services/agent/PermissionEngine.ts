/**
 * PermissionEngine — single source of truth for mapping the unified
 * AgentPermissionMode onto each CLI's native permission surface.
 *
 * Fail-closed: anything unrecognized normalizes to "read-only".
 *
 * | mode        | claude/openclaude                          | codex                      | opencode                       |
 * |-------------|--------------------------------------------|----------------------------|--------------------------------|
 * | read-only   | default mode + write tools disallowed      | --sandbox read-only        | permission edit/bash = deny    |
 * | auto-edit   | --permission-mode acceptEdits              | --sandbox workspace-write  | edit allow, bash ask (rejected)|
 * | full-access | --dangerously-skip-permissions             | --sandbox danger-full-access| --dangerously-skip-permissions |
 *
 * Headless note: in non-interactive (--print / run / exec) mode there is no
 * terminal prompt, so "needs approval" means auto-denied unless an approval
 * tool is wired (claude-style CLIs support --permission-prompt-tool, which we
 * point at the meeting MCP server's request_permission tool).
 */

import {
  AgentPermissionMode,
  AGENT_PERMISSION_MODES,
} from "./types";
import type { CodexSandboxMode } from "../CodexCliService";

export const MEETING_MCP_SERVER_NAME = "momor-meeting";
export const APPROVAL_TOOL_NAME = `mcp__${MEETING_MCP_SERVER_NAME}__request_permission`;

const CLAUDE_WRITE_TOOLS = [
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
  "Bash",
];

export function normalizePermissionMode(input: unknown): AgentPermissionMode {
  if (
    typeof input === "string" &&
    (AGENT_PERMISSION_MODES as readonly string[]).includes(input)
  ) {
    return input as AgentPermissionMode;
  }
  return "read-only";
}

export function requiresExplicitConfirmation(
  mode: AgentPermissionMode,
): boolean {
  return mode === "full-access";
}

/**
 * Flags for claude / openclaude.
 *
 * Important: do NOT pass --allowed-tools here just to "allow the meeting MCP".
 * In Claude Code/OpenClaude that flag is a real allowlist, so passing only the
 * MCP server silently strips Read/Glob/Grep/Edit/Write/Bash from the session
 * and makes the agent act like it has no filesystem access.
 *
 * The permission prompt MCP tool is wired separately via
 * --permission-prompt-tool and does not need to be exposed in the normal tool
 * list.
 */
export function permissionArgsForClaude(
  mode: AgentPermissionMode,
  approvalToolName?: string,
): string[] {
  const args: string[] = [];

  switch (mode) {
    case "full-access":
      args.push("--dangerously-skip-permissions");
      return args;
    case "auto-edit":
      args.push("--permission-mode", "acceptEdits");
      break;
    case "read-only":
    default:
      args.push("--disallowed-tools", CLAUDE_WRITE_TOOLS.join(","));
      break;
  }

  if (approvalToolName) {
    args.push("--permission-prompt-tool", approvalToolName);
  }
  return args;
}

/** CLI flags for opencode run. Permission *rules* go into opencode.json instead. */
export function permissionArgsForOpenCode(
  mode: AgentPermissionMode,
): string[] {
  return mode === "full-access" ? ["--dangerously-skip-permissions"] : [];
}

/**
 * Permission rules merged into opencode.json. Headless opencode auto-rejects
 * anything that "asks", so ask == fail-closed deny-with-feedback.
 */
export function opencodePermissionConfig(
  mode: AgentPermissionMode,
): Record<string, string> | undefined {
  switch (mode) {
    case "read-only":
      return { edit: "deny", bash: "deny" };
    case "auto-edit":
      return { edit: "allow", bash: "ask" };
    case "full-access":
      return undefined; // --dangerously-skip-permissions approves asks
    default:
      return { edit: "deny", bash: "deny" };
  }
}

export function sandboxForCodex(mode: AgentPermissionMode): CodexSandboxMode {
  switch (mode) {
    case "auto-edit":
      return "workspace-write";
    case "full-access":
      return "danger-full-access";
    case "read-only":
    default:
      return "read-only";
  }
}
