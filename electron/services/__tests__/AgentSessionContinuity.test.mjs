import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.resolve(
  __dirname,
  "../../../dist-electron/electron/services/agent/AgentOrchestrator.js",
);

const { resolveCliResumeSessionId } = await import(
  pathToFileURL(compiled).href
);

test("resolveCliResumeSessionId keeps continuity inside the same workspace", () => {
  const workspace = path.join(os.tmpdir(), "momor-agent-session-same");
  assert.equal(
    resolveCliResumeSessionId(
      {
        sessionId: "sess-123",
        workspaceDir: workspace,
      },
      workspace,
    ),
    "sess-123",
  );
});

test("resolveCliResumeSessionId drops continuity when the workspace changes", () => {
  const firstWorkspace = path.join(os.tmpdir(), "momor-agent-session-a");
  const secondWorkspace = path.join(os.tmpdir(), "momor-agent-session-b");

  assert.equal(
    resolveCliResumeSessionId(
      {
        sessionId: "sess-123",
        workspaceDir: firstWorkspace,
      },
      secondWorkspace,
    ),
    undefined,
  );
});
