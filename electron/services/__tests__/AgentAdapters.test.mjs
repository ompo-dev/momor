// Tests run against the esbuild-compiled adapters in dist-electron/.
// Run via: npm run build:electron && node --test electron/services/__tests__/

import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(__dirname, "../../../dist-electron/electron/services/agent");
const load = (f) => import(pathToFileURL(path.join(base, f)).href);

const { ClaudeCodeAdapter } = await load("ClaudeCodeAdapter.js");
const { OpenCodeAdapter } = await load("OpenCodeAdapter.js");
const { CodexAdapter } = await load("CodexAdapter.js");
const { createParseState } = await load("types.js");

function ctx(overrides = {}) {
  return {
    executablePath: "claude",
    model: "claude-sonnet-4-6",
    workspaceDir: path.join(os.tmpdir(), "agent-ws"),
    permissionMode: "auto-edit",
    ...overrides,
  };
}

// ─────────────────────────── ClaudeCodeAdapter ───────────────────────────

test("claude buildSpawn: node script routes through process.execPath + stream-json", () => {
  const adapter = new ClaudeCodeAdapter("openclaude");
  const spec = adapter.buildSpawn(
    { prompt: "make a file" },
    ctx({ executablePath: "C:\\x\\cli.mjs", mcpConfigPath: "/tmp/mcp.json", model: "m1" }),
  );
  assert.equal(spec.cmd, process.execPath);
  assert.equal(spec.args[0], "C:\\x\\cli.mjs");
  assert.ok(spec.args.includes("--print"));
  assert.equal(spec.args[spec.args.indexOf("--output-format") + 1], "stream-json");
  assert.ok(spec.args.includes("--include-partial-messages"));
  assert.equal(spec.args[spec.args.indexOf("--mcp-config") + 1], "/tmp/mcp.json");
  assert.equal(spec.args[spec.args.indexOf("--model") + 1], "m1");
  assert.equal(spec.stdinPrompt, "make a file");
  assert.equal(spec.cwd, ctx().workspaceDir);
  // The deprecated --bare flag must be gone.
  assert.ok(!spec.args.includes("--bare"));
});

test("claude buildSpawn: resume kept in args and system prompt moves to stdin", () => {
  const adapter = new ClaudeCodeAdapter("claude");
  const spec = adapter.buildSpawn(
    { prompt: "hi", systemPrompt: "ctx", cliSessionId: "sess-123" },
    ctx(),
  );
  assert.equal(spec.args[spec.args.indexOf("--resume") + 1], "sess-123");
  assert.ok(!spec.args.includes("--append-system-prompt"));
  assert.match(spec.stdinPrompt, /<system-context>/);
  assert.match(spec.stdinPrompt, /ctx/);
  assert.match(spec.stdinPrompt, /hi/);
});

test("claude buildSpawn: structured stdin also carries system context", () => {
  const adapter = new ClaudeCodeAdapter("claude");
  const spec = adapter.buildSpawn(
    { prompt: "look at this", systemPrompt: "ctx", imagePaths: ["missing.png"] },
    ctx(),
  );
  assert.ok(spec.args.includes("--input-format=stream-json"));
  assert.ok(!spec.args.includes("--append-system-prompt"));
  assert.match(spec.stdinPrompt, /<system-context>/);
  assert.match(spec.stdinPrompt, /ctx/);
  assert.match(spec.stdinPrompt, /look at this/);
});

test("claude parseLine: init→session, delta→token, tool_use→tool_call, result→done", () => {
  const adapter = new ClaudeCodeAdapter("openclaude");
  const s = createParseState();

  assert.deepEqual(
    adapter.parseLine({ type: "system", subtype: "init", session_id: "abc" }, s),
    [{ type: "session", sessionId: "abc" }],
  );
  assert.equal(s.sessionId, "abc");

  const tok = adapter.parseLine(
    { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } } },
    s,
  );
  assert.deepEqual(tok, [{ type: "token", text: "Hel" }]);
  assert.equal(s.sawTextDelta, true);

  // Full assistant text block is deduped once deltas were seen.
  const dup = adapter.parseLine(
    { type: "assistant", message: { content: [{ type: "text", text: "Hello" }] } },
    s,
  );
  assert.deepEqual(dup, []);

  const call = adapter.parseLine(
    { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "Write", input: { path: "a.html" } } ] } },
    s,
  );
  assert.deepEqual(call, [{ type: "tool_call", toolId: "t1", toolName: "Write", toolArgs: { path: "a.html" } }]);

  const res = adapter.parseLine(
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "ok", is_error: false }] } },
    s,
  );
  assert.deepEqual(res, [{ type: "tool_result", toolId: "t1", toolResult: "ok", toolIsError: false }]);

  const done = adapter.parseLine({ type: "result", subtype: "success", result: "done", total_cost_usd: 0.01, session_id: "abc" }, s);
  assert.equal(done.at(-1).type, "done");
  assert.equal(done.at(-1).costUsd, 0.01);
  assert.equal(done.at(-1).fullText, "done");
});

// ─────────────────────────── OpenCodeAdapter ───────────────────────────

test("opencode buildSpawn: run --format json, no --print, system prompt inlined", () => {
  const adapter = new OpenCodeAdapter();
  const spec = adapter.buildSpawn(
    { prompt: "build site", systemPrompt: "meeting ctx", model: "anthropic/claude", cliSessionId: "S1" },
    ctx({ executablePath: "opencode" }),
  );
  assert.equal(spec.args[0], "run");
  assert.equal(spec.args[spec.args.indexOf("--format") + 1], "json");
  assert.ok(!spec.args.includes("--print"));
  assert.ok(!spec.args.includes("--output-format"));
  assert.equal(spec.args[spec.args.indexOf("--model") + 1], "anthropic/claude");
  assert.equal(spec.args[spec.args.indexOf("--session") + 1], "S1");
  assert.match(spec.stdinPrompt, /meeting ctx/);
  assert.match(spec.stdinPrompt, /build site/);
});

test("opencode prepareWorkspaceConfig writes mcp + permission, preserving user keys", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-cfg-"));
  fs.writeFileSync(path.join(dir, "opencode.json"), JSON.stringify({ theme: "nord", mcp: { other: { type: "local" } } }));
  const out = OpenCodeAdapter.prepareWorkspaceConfig(dir, "http://127.0.0.1:19876/sse", { edit: "allow", bash: "ask" });
  const cfg = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(cfg.theme, "nord");                  // user key preserved
  assert.ok(cfg.mcp.other);                          // user mcp preserved
  assert.equal(cfg.mcp["momor-meeting"].type, "remote");
  assert.equal(cfg.mcp["momor-meeting"].url, "http://127.0.0.1:19876/sse");
  assert.equal(cfg.permission.edit, "allow");
  assert.equal(cfg.permission.bash, "ask");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("opencode parseLine: session, text→token, tool_use→call+result, error", () => {
  const adapter = new OpenCodeAdapter();
  const s = createParseState();

  const sess = adapter.parseLine({ type: "text", sessionID: "oc1", part: { id: "p1", text: "Hi" } }, s);
  assert.ok(sess.some((e) => e.type === "session" && e.sessionId === "oc1"));
  assert.ok(sess.some((e) => e.type === "token" && e.text === "Hi"));

  // Same part id is not re-emitted.
  const dup = adapter.parseLine({ type: "text", sessionID: "oc1", part: { id: "p1", text: "Hi" } }, s);
  assert.deepEqual(dup, []);

  const tool = adapter.parseLine(
    { type: "tool_use", sessionID: "oc1", part: { id: "tp", tool: "write", callID: "c1", state: { status: "completed", input: { filePath: "x" }, output: "wrote" } } },
    s,
  );
  assert.deepEqual(tool, [
    { type: "tool_call", toolId: "c1", toolName: "write", toolArgs: { filePath: "x" } },
    { type: "tool_result", toolId: "c1", toolResult: "wrote", toolIsError: false },
  ]);

  const err = adapter.parseLine({ type: "error", sessionID: "oc1", error: { data: { message: "boom" } } }, s);
  assert.deepEqual(err, [{ type: "error", error: "boom" }]);
});

// ─────────────────────────── CodexAdapter ───────────────────────────

test("codex buildSpawn: exec --json --sandbox, resume subcommand, prompt on stdin", () => {
  const adapter = new CodexAdapter();
  const spec = adapter.buildSpawn(
    { prompt: "do it", systemPrompt: "sys", model: "gpt-5.4", cliSessionId: "thread-9" },
    ctx({ executablePath: "codex", permissionMode: "auto-edit" }),
  );
  assert.equal(spec.args[0], "exec");
  assert.equal(spec.args[1], "resume");
  assert.equal(spec.args[2], "thread-9");
  assert.ok(spec.args.includes("--json"));
  assert.equal(spec.args[spec.args.indexOf("--sandbox") + 1], "workspace-write");
  assert.match(spec.stdinPrompt, /sys/);
  assert.match(spec.stdinPrompt, /do it/);
});

test("codex parseLine: thread.started→session, agent_message→token, command→tool, turn.completed→done", () => {
  const adapter = new CodexAdapter();
  const s = createParseState();

  assert.deepEqual(
    adapter.parseLine({ type: "thread.started", thread_id: "th1" }, s),
    [{ type: "session", sessionId: "th1" }],
  );

  const msg = adapter.parseLine({ type: "item.completed", item: { id: "i1", item_type: "agent_message", text: "Answer" } }, s);
  assert.deepEqual(msg, [{ type: "token", text: "Answer" }]);

  const cmdStart = adapter.parseLine({ type: "item.started", item: { id: "c1", item_type: "command_execution", command: "ls" } }, s);
  assert.deepEqual(cmdStart, [{ type: "tool_call", toolId: "c1", toolName: "Bash", toolArgs: { command: "ls" } }]);

  const cmdDone = adapter.parseLine({ type: "item.completed", item: { id: "c1", item_type: "command_execution", exit_code: 0, aggregated_output: "out" } }, s);
  assert.deepEqual(cmdDone, [{ type: "tool_result", toolId: "c1", toolResult: "out", toolIsError: false }]);

  assert.deepEqual(adapter.parseLine({ type: "turn.completed" }, s), [{ type: "done", sessionId: "th1" }]);

  const fail = adapter.parseLine({ type: "turn.failed", message: "nope" }, s);
  assert.equal(fail[0].type, "error");
});

after(() => {
  try { fs.rmSync(path.join(os.tmpdir(), "agent-ws"), { recursive: true, force: true }); } catch {}
});
