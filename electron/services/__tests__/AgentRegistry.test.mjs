// Tests the external-agent catalog (builtin + custom) and transport selection.
// Run via: npm run build:electron && node --test electron/services/__tests__/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(__dirname, "../../../dist-electron/electron/services/agent");
const { AgentRegistry } = await import(pathToFileURL(path.join(base, "AgentRegistry.js")).href);

test("builtin agents expose the right transports (Zed-style)", () => {
  const list = AgentRegistry.list({});
  const byId = Object.fromEntries(list.map((a) => [a.id, a]));

  assert.equal(byId.openclaude.transport, "claude-stream-json");
  assert.equal(byId.claude.transport, "claude-stream-json");
  assert.equal(byId.codex.transport, "codex-exec");
  // opencode speaks ACP natively → persistent session transport.
  assert.equal(byId.opencode.transport, "acp");

  for (const id of ["claude", "openclaude", "codex", "opencode"]) {
    assert.equal(byId[id].builtin, true);
  }
});

test("custom ACP agents appear in the catalog ('Add More Agents')", () => {
  const list = AgentRegistry.list({
    customAgents: [
      { id: "cursor", name: "Cursor", command: "cursor-agent", args: ["acp"] },
      { id: "gemini", name: "Gemini CLI", command: "gemini", args: ["--experimental-acp"] },
    ],
  });
  const cursor = list.find((a) => a.id === "cursor");
  const gemini = list.find((a) => a.id === "gemini");

  assert.ok(cursor && !cursor.builtin);
  assert.equal(cursor.transport, "acp");
  assert.deepEqual(cursor.args, ["acp"]);
  assert.ok(gemini && gemini.transport === "acp");
  // Bare commands are considered available (PATH resolves at spawn time).
  assert.equal(cursor.available, true);
});

test("find() resolves a builtin by id", () => {
  const spec = AgentRegistry.find("codex", {});
  assert.ok(spec);
  assert.equal(spec.id, "codex");
  assert.equal(spec.transport, "codex-exec");
});

test("malformed custom agents are skipped", () => {
  const list = AgentRegistry.list({
    customAgents: [
      { id: "", name: "no id", command: "x" },
      { id: "ok", name: "ok", command: "" },
      { id: "good", name: "Good", command: "good-agent" },
    ],
  });
  const customIds = list.filter((a) => !a.builtin).map((a) => a.id);
  assert.deepEqual(customIds, ["good"]);
});

test("invalid configured executable paths fall back to sane defaults instead of returning garbage", () => {
  const fakeOpenClaudePath = "C:\\" + "broken\\".repeat(80) + "openclaude.cmd";
  const tempCodex = path.join(os.tmpdir(), "momor-codex-test.cmd");
  fs.writeFileSync(tempCodex, "@echo off\r\necho codex\r\n", "utf8");

  const list = AgentRegistry.list({
    executablePaths: {
      openclaude: fakeOpenClaudePath,
      codex: tempCodex,
    },
  });

  const byId = Object.fromEntries(list.map((agent) => [agent.id, agent]));
  assert.notEqual(byId.openclaude.command, fakeOpenClaudePath);
  assert.equal(byId.codex.command, tempCodex);

  fs.rmSync(tempCodex, { force: true });
});
