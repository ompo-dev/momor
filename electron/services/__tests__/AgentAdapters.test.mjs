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

function readNativeSystemPrompt(spec) {
  const index = spec.args.indexOf("--append-system-prompt-file");
  assert.notEqual(index, -1, "expected --append-system-prompt-file");
  const filePath = spec.args[index + 1];
  assert.ok(filePath, "expected runtime system prompt file path");
  return fs.readFileSync(filePath, "utf8");
}

// ─────────────────────────── ClaudeCodeAdapter ───────────────────────────

test("claude buildSpawn: node script routes through process.execPath + stream-json", () => {
  const adapter = new ClaudeCodeAdapter("openclaude");
  const spec = adapter.buildSpawn(
    { prompt: "make a file" },
    ctx({ executablePath: "C:\\x\\cli.mjs", mcpConfigPath: "/tmp/mcp.json", model: "m1" }),
  );
  const runtimePrompt = readNativeSystemPrompt(spec);
  assert.equal(spec.cmd, process.execPath);
  assert.equal(spec.args[0], "C:\\x\\cli.mjs");
  assert.ok(spec.args.includes("--print"));
  assert.equal(spec.args[spec.args.indexOf("--output-format") + 1], "stream-json");
  assert.ok(spec.args.includes("--include-partial-messages"));
  assert.equal(spec.args[spec.args.indexOf("--mcp-config") + 1], "/tmp/mcp.json");
  assert.equal(spec.args[spec.args.indexOf("--model") + 1], "m1");
  assert.match(runtimePrompt, /<runtime-capabilities>/);
  assert.match(spec.stdinPrompt, /make a file/);
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
  const runtimePrompt = readNativeSystemPrompt(spec);
  assert.equal(spec.args[spec.args.indexOf("--resume") + 1], "sess-123");
  assert.match(spec.stdinPrompt, /<system-context>/);
  assert.match(spec.stdinPrompt, /ctx/);
  assert.match(spec.stdinPrompt, /hi/);
  assert.match(runtimePrompt, /Primary workspace root:/);
});

test("claude buildSpawn: structured stdin also carries system context", () => {
  const adapter = new ClaudeCodeAdapter("claude");
  const spec = adapter.buildSpawn(
    { prompt: "look at this", systemPrompt: "ctx", imagePaths: ["missing.png"] },
    ctx(),
  );
  const runtimePrompt = readNativeSystemPrompt(spec);
  assert.ok(spec.args.includes("--input-format=stream-json"));
  assert.match(spec.stdinPrompt, /<system-context>/);
  assert.match(spec.stdinPrompt, /ctx/);
  assert.match(spec.stdinPrompt, /look at this/);
  assert.match(runtimePrompt, /filesystem, shell, MCP, and skill tools enabled/);
});

test("claude buildSpawn: explicit absolute file paths become add-dir + runtime access context", () => {
  const adapter = new ClaudeCodeAdapter("openclaude");
  const externalDir = path.join(os.tmpdir(), "momor-external-read");
  const externalFile = path.join(externalDir, "README.md");
  fs.mkdirSync(externalDir, { recursive: true });
  fs.writeFileSync(
    externalFile,
    "# test\nThis README explains the local project context.\n",
    "utf8",
  );

  const spec = adapter.buildSpawn(
    { prompt: `summarize "${externalFile}"`, systemPrompt: "ctx" },
    ctx({ executablePath: "C:\\x\\cli.mjs" }),
  );
  const runtimePrompt = readNativeSystemPrompt(spec);
  const addDirValues = spec.args.filter(
    (value, index) => spec.args[index - 1] === "--add-dir",
  );

  assert.deepEqual(addDirValues, [ctx().workspaceDir, externalDir]);
  assert.match(runtimePrompt, /<runtime-capabilities>/);
  assert.match(runtimePrompt, /Current permission mode: auto-edit/);
  assert.match(runtimePrompt, /The user's latest request explicitly references these local paths:/);
  assert.match(runtimePrompt, new RegExp(externalFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(runtimePrompt, new RegExp(ctx().workspaceDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(runtimePrompt, new RegExp(externalDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(runtimePrompt, /<preloaded-local-references>/);
  assert.match(runtimePrompt, /Host verification: read succeeded before the agent turn\./);
  assert.match(runtimePrompt, /The host already granted access to these roots before your reply\./);
  assert.match(runtimePrompt, /answer from that file instead of asking the user to paste it again/i);
  assert.match(runtimePrompt, /If a Read tool succeeds or the host already preloaded file content, treat access to that path as proven/i);
  assert.match(runtimePrompt, /create, edit, move, rename, or delete files inside the workspace or granted roots/i);
  assert.match(runtimePrompt, /Before replying to an explicit local-path request, your first action should be a filesystem inspection on that target/i);
  assert.match(runtimePrompt, /Do not answer an explicit local-path request from memory, prior context, or a generic permission disclaimer\./);
  assert.match(runtimePrompt, /A generic 'I do not have access' reply is incorrect unless the tool itself returned that failure\./);
  assert.match(runtimePrompt, /Do not claim you lack access to these files unless a fresh tool call fails/);
  assert.match(runtimePrompt, /This README explains the local project context\./);
  assert.match(runtimePrompt, /If a tool fails, describe the exact failure you saw instead of speculating about generic permissions\./);
  assert.match(spec.stdinPrompt, /ctx/);
  assert.match(spec.stdinPrompt, /<turn-local-path-guidance>/);
  assert.match(spec.stdinPrompt, /This turn explicitly references local paths the user intentionally shared:/);
  assert.match(spec.stdinPrompt, new RegExp(externalFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(spec.stdinPrompt, /Start by using Read on a referenced file, or Glob\/Grep on a referenced folder, before drafting your answer\./);
  assert.match(spec.stdinPrompt, /The host already preloaded readable excerpts from the referenced local files below\./);
  assert.match(spec.stdinPrompt, /These excerpts are grounded local evidence for this turn\./);
  assert.match(spec.stdinPrompt, /A reply that says you lack access would be factually wrong unless a fresh Read, Glob, or Grep call fails afterwards\./);
  assert.match(spec.stdinPrompt, /<preloaded-local-references>/);
  assert.match(spec.stdinPrompt, /This README explains the local project context\./);
  assert.match(spec.stdinPrompt, /Do not say you lack access unless Read, Glob, or Grep actually fails during this turn\./);
});

test("claude buildSpawn: agentic turns get runtime tool context even without extra dirs", () => {
  const adapter = new ClaudeCodeAdapter("openclaude");
  const spec = adapter.buildSpawn(
    { prompt: "inspect the workspace and fix the bug" },
    ctx({ executablePath: "C:\\x\\cli.mjs" }),
  );
  const runtimePrompt = readNativeSystemPrompt(spec);
  const addDirValues = spec.args.filter(
    (value, index) => spec.args[index - 1] === "--add-dir",
  );

  assert.deepEqual(addDirValues, [ctx().workspaceDir]);
  assert.match(runtimePrompt, /<runtime-capabilities>/);
  assert.match(runtimePrompt, /filesystem, shell, MCP, and skill tools enabled/);
  assert.match(runtimePrompt, /Primary workspace root:/);
  assert.match(runtimePrompt, /Use Read, Glob, or Grep/);
});

test("claude buildSpawn: add-dir extraction ignores historical CONTEXT paths and only grants the latest user request", () => {
  const adapter = new ClaudeCodeAdapter("openclaude");
  const oldDir = path.join(os.tmpdir(), "momor-old-context");
  const oldFile = path.join(oldDir, "OLD.md");
  const currentDir = path.join(os.tmpdir(), "momor-current-request");
  const currentFile = path.join(currentDir, "README.md");

  fs.mkdirSync(oldDir, { recursive: true });
  fs.mkdirSync(currentDir, { recursive: true });
  fs.writeFileSync(oldFile, "# old", "utf8");
  fs.writeFileSync(currentFile, "# current", "utf8");

  const spec = adapter.buildSpawn(
    {
      prompt: `CONTEXT:\nPreviously discussed file: "${oldFile}"\n\nUSER QUESTION:\nSummarize "${currentFile}"`,
    },
    ctx({ executablePath: "C:\\x\\cli.mjs" }),
  );
  const runtimePrompt = readNativeSystemPrompt(spec);

  const addDirValues = spec.args.filter((value, index) => spec.args[index - 1] === "--add-dir");
  const runtimeBlock = runtimePrompt.match(
    /<runtime-capabilities>[\s\S]*?<\/runtime-capabilities>/,
  )?.[0];

  assert.deepEqual(addDirValues, [ctx().workspaceDir, currentDir]);
  assert.ok(runtimeBlock, "runtime capabilities block should exist");
  assert.match(runtimeBlock, new RegExp(currentFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(runtimeBlock, new RegExp(oldFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("claude buildSpawn: promoted explicit workspace still gets an add-dir grant for the active root", () => {
  const adapter = new ClaudeCodeAdapter("openclaude");
  const explicitDir = path.join(os.tmpdir(), "momor-promoted-workspace");
  const explicitFile = path.join(explicitDir, "README.md");
  fs.mkdirSync(explicitDir, { recursive: true });
  fs.writeFileSync(explicitFile, "# promoted\n", "utf8");

  const spec = adapter.buildSpawn(
    { prompt: `summarize "${explicitFile}"` },
    ctx({
      executablePath: "C:\\x\\cli.mjs",
      workspaceDir: explicitDir,
    }),
  );

  const addDirValues = spec.args.filter(
    (value, index) => spec.args[index - 1] === "--add-dir",
  );

  assert.deepEqual(addDirValues, [explicitDir]);
});

test("claude buildSpawn: plain mode skips agent runtime context and add-dir grants", () => {
  const adapter = new ClaudeCodeAdapter("openclaude");
  const externalDir = path.join(os.tmpdir(), "momor-plain-mode");
  const externalFile = path.join(externalDir, "README.md");
  fs.mkdirSync(externalDir, { recursive: true });
  fs.writeFileSync(externalFile, "# plain", "utf8");

  const spec = adapter.buildSpawn(
    { prompt: `summarize "${externalFile}"` },
    ctx({ executablePath: "C:\\x\\cli.mjs", toolMode: "plain" }),
  );

  assert.ok(!spec.args.includes("--add-dir"));
  assert.ok(!spec.args.includes("--append-system-prompt-file"));
  assert.doesNotMatch(spec.stdinPrompt, /<runtime-capabilities>/);
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
