// Tests run against the esbuild-compiled PermissionEngine in dist-electron/.
// Run via: npm run build:electron && node --test electron/services/__tests__/

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.resolve(
  __dirname,
  "../../../dist-electron/electron/services/agent/PermissionEngine.js",
);
const {
  normalizePermissionMode,
  requiresExplicitConfirmation,
  permissionArgsForClaude,
  permissionArgsForOpenCode,
  opencodePermissionConfig,
  sandboxForCodex,
  APPROVAL_TOOL_NAME,
  MEETING_MCP_ALLOW_RULE,
} = await import(pathToFileURL(compiled).href);

test("normalizePermissionMode is fail-closed", () => {
  assert.equal(normalizePermissionMode("auto-edit"), "auto-edit");
  assert.equal(normalizePermissionMode("full-access"), "full-access");
  assert.equal(normalizePermissionMode("read-only"), "read-only");
  assert.equal(normalizePermissionMode("garbage"), "read-only");
  assert.equal(normalizePermissionMode(undefined), "read-only");
  assert.equal(normalizePermissionMode(42), "read-only");
});

test("only full-access requires explicit confirmation", () => {
  assert.equal(requiresExplicitConfirmation("full-access"), true);
  assert.equal(requiresExplicitConfirmation("auto-edit"), false);
  assert.equal(requiresExplicitConfirmation("read-only"), false);
});

test("claude read-only disallows write tools and never skips permissions", () => {
  const args = permissionArgsForClaude("read-only");
  assert.ok(args.includes("--allowed-tools"));
  assert.ok(args.includes(MEETING_MCP_ALLOW_RULE));
  assert.ok(args.includes("--disallowed-tools"));
  const disallowed = args[args.indexOf("--disallowed-tools") + 1];
  assert.match(disallowed, /Write/);
  assert.match(disallowed, /Bash/);
  assert.ok(!args.includes("--dangerously-skip-permissions"));
});

test("claude auto-edit uses acceptEdits and routes approvals to the MCP tool", () => {
  const args = permissionArgsForClaude("auto-edit", APPROVAL_TOOL_NAME);
  assert.ok(args.includes("--permission-mode"));
  assert.equal(args[args.indexOf("--permission-mode") + 1], "acceptEdits");
  assert.ok(args.includes("--permission-prompt-tool"));
  assert.equal(args[args.indexOf("--permission-prompt-tool") + 1], APPROVAL_TOOL_NAME);
  assert.ok(!args.includes("--dangerously-skip-permissions"));
});

test("claude full-access skips permissions and does NOT add an approval tool", () => {
  const args = permissionArgsForClaude("full-access", APPROVAL_TOOL_NAME);
  assert.ok(args.includes("--dangerously-skip-permissions"));
  assert.ok(!args.includes("--permission-prompt-tool"));
});

test("opencode flags: only full-access skips permissions", () => {
  assert.deepEqual(permissionArgsForOpenCode("read-only"), []);
  assert.deepEqual(permissionArgsForOpenCode("auto-edit"), []);
  assert.deepEqual(permissionArgsForOpenCode("full-access"), ["--dangerously-skip-permissions"]);
});

test("opencode config rules map per mode (fail-closed deny on read-only)", () => {
  assert.deepEqual(opencodePermissionConfig("read-only"), { edit: "deny", bash: "deny" });
  assert.deepEqual(opencodePermissionConfig("auto-edit"), { edit: "allow", bash: "ask" });
  assert.equal(opencodePermissionConfig("full-access"), undefined);
});

test("codex sandbox maps from unified modes", () => {
  assert.equal(sandboxForCodex("read-only"), "read-only");
  assert.equal(sandboxForCodex("auto-edit"), "workspace-write");
  assert.equal(sandboxForCodex("full-access"), "danger-full-access");
});

test("approval tool name targets the meeting MCP server", () => {
  assert.equal(APPROVAL_TOOL_NAME, "mcp__momor-meeting__request_permission");
});
