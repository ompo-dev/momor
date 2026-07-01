// End-to-end ACP transport test against a fake ACP agent process.
// Proves: JSON-RPC handshake, session/new, streaming session/update events,
// and that an agent-initiated fs/write_text_file is honored by the host's
// workspace-scoped bridge (this is what makes file edits actually happen).
//
// Run via: npm run build:electron && node --test electron/services/__tests__/

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(__dirname, "../../../dist-electron/electron/services/agent");
const { AcpAgentConnection } = await import(
  pathToFileURL(path.join(base, "acp/AcpAgentConnection.js")).href
);

// A fake ACP agent: speaks ndjson JSON-RPC on stdio. On session/prompt it
// streams a thought + text, asks the host to write a file, then completes.
const FAKE_AGENT = path.join(os.tmpdir(), `fake-acp-agent-${process.pid}.mjs`);
const FAKE_SRC = `
let buf = "";
function send(o){ process.stdout.write(JSON.stringify(o) + "\\n"); }
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const lines = buf.split("\\n"); buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") {
      send({ jsonrpc:"2.0", id: msg.id, result: { protocolVersion: 1, agentCapabilities: { mcpCapabilities: { sse: true } } } });
    } else if (msg.method === "session/new") {
      send({ jsonrpc:"2.0", id: msg.id, result: { sessionId: "sess-fake-1" } });
    } else if (msg.method === "session/prompt") {
      const sid = msg.params.sessionId;
      send({ jsonrpc:"2.0", method:"session/update", params:{ sessionId: sid, update:{ sessionUpdate:"agent_thought_chunk", content:{ type:"text", text:"thinking..." } } } });
      send({ jsonrpc:"2.0", method:"session/update", params:{ sessionId: sid, update:{ sessionUpdate:"agent_message_chunk", content:{ type:"text", text:"Writing file. " } } } });
      send({ jsonrpc:"2.0", method:"session/update", params:{ sessionId: sid, update:{ sessionUpdate:"tool_call", toolCallId:"t1", title:"Write site.html", kind:"edit", rawInput:{ path:"site.html" } } } });
      // Ask the HOST to write the file (this is the real edit path).
      const wid = 9001;
      send({ jsonrpc:"2.0", id: wid, method:"fs/write_text_file", params:{ path:"site.html", content:"<h1>Reuniao</h1>" } });
      // Wait for the host's response before finishing.
      const onResp = (l) => {};
      // crude: respond to prompt after a tick
      setTimeout(() => {
        send({ jsonrpc:"2.0", method:"session/update", params:{ sessionId: sid, update:{ sessionUpdate:"tool_call_update", toolCallId:"t1", status:"completed", content:[{ type:"content", content:{ type:"text", text:"wrote 16 bytes" } }] } } });
        send({ jsonrpc:"2.0", id: msg.id, result: { stopReason: "end_turn" } });
      }, 80);
    }
  }
});
`;

before(() => fs.writeFileSync(FAKE_AGENT, FAKE_SRC, "utf8"));
after(() => { try { fs.unlinkSync(FAKE_AGENT); } catch {} });

// Windows holds the child's cwd handle briefly after kill; cleanup is not the
// assertion, so make it best-effort with a short grace period.
async function cleanupWs(conn, ws) {
  conn.dispose();
  await new Promise((r) => setTimeout(r, 60));
  try { fs.rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
}

test("ACP: handshake → session → streamed events → host writes the file", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "acp-ws-"));
  const events = [];

  const conn = await AcpAgentConnection.connect(
    { cmd: process.execPath, args: [FAKE_AGENT], env: { ...process.env }, cwd: ws },
    {
      permissionMode: "auto-edit",
      workspaceDir: ws,
      requestUserPermission: async () => ({ allow: true }),
      onEvent: (e) => events.push(e),
    },
  );

  const sessionId = await conn.newSession("http://127.0.0.1:19876/sse");
  assert.equal(sessionId, "sess-fake-1");

  const { stopReason } = await conn.prompt("build a site about the meeting");
  assert.equal(stopReason, "end_turn");

  // Give the queue a tick to flush the last update.
  await new Promise((r) => setTimeout(r, 30));

  const kinds = events.map((e) => e.type);
  assert.ok(kinds.includes("thinking"), "should stream a thinking event");
  assert.ok(kinds.includes("token"), "should stream a token event");
  assert.ok(kinds.includes("tool_call"), "should surface the tool call");

  // The crux: the agent's fs/write_text_file actually created the file in-workspace.
  const written = path.join(ws, "site.html");
  assert.ok(fs.existsSync(written), "agent-driven file write must land on disk");
  assert.equal(fs.readFileSync(written, "utf8"), "<h1>Reuniao</h1>");

  await cleanupWs(conn, ws);
});

test("ACP read-only mode rejects host writes", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "acp-ro-"));
  const conn = await AcpAgentConnection.connect(
    { cmd: process.execPath, args: [FAKE_AGENT], env: { ...process.env }, cwd: ws },
    {
      permissionMode: "read-only",
      workspaceDir: ws,
      requestUserPermission: async () => ({ allow: true }),
      onEvent: () => {},
    },
  );
  await conn.newSession();
  await conn.prompt("try to write");
  await new Promise((r) => setTimeout(r, 30));
  // In read-only the host throws on fs/write, so the file must NOT exist.
  assert.ok(!fs.existsSync(path.join(ws, "site.html")), "read-only must block writes");
  await cleanupWs(conn, ws);
});
