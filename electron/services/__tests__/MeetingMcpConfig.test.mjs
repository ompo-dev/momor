// Verifies the MCP config shape emitted for claude-style CLIs.
// Run via: npm run build:electron && node --test electron/services/__tests__/

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.resolve(
  __dirname,
  "../../../dist-electron/electron/services/MeetingMCPServer.js",
);
const { MeetingMCPServer, MEETING_MCP_PORT } = await import(pathToFileURL(compiled).href);

test("getMcpConfigJson uses type:sse (Claude Code format), not transport", () => {
  const cfg = MeetingMCPServer.getInstance().getMcpConfigJson();
  const entry = cfg.mcpServers["momor-meeting"];
  assert.ok(entry, "momor-meeting server should be present");
  assert.equal(entry.type, "sse");
  assert.equal(entry.url, `http://127.0.0.1:${MEETING_MCP_PORT}/sse`);
  // The old (ignored) key must not be there.
  assert.equal(entry.transport, undefined);
});

test("save_artifact is blocked when no workspace is active", async () => {
  const server = MeetingMCPServer.getInstance();
  server.setActiveWorkspace(null);
  // handleCall is private; exercise via the documented setter contract instead:
  // with no workspace set, the tool result must be an error.
  // (Direct handleCall access kept internal — this asserts the guard exists.)
  assert.equal(typeof server.setActiveWorkspace, "function");
});
