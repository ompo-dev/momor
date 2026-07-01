// Tests run against the esbuild-compiled WorkspaceManager in dist-electron/.
// Run via: npm run build:electron && node --test electron/services/__tests__/

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.resolve(
  __dirname,
  "../../../dist-electron/electron/services/agent/WorkspaceManager.js",
);
const { WorkspaceManager } = await import(pathToFileURL(compiled).href);

const wm = WorkspaceManager.getInstance();

test("containsPath accepts in-workspace and rejects escapes", () => {
  const ws = path.join(os.tmpdir(), "momor-ws-test");
  assert.equal(wm.containsPath(ws, "summary/index.html"), true);
  assert.equal(wm.containsPath(ws, "./a/b.txt"), true);
  assert.equal(wm.containsPath(ws, "../escape.txt"), false);
  assert.equal(wm.containsPath(ws, "../../etc/passwd"), false);
  // Absolute path outside the workspace is rejected.
  const outside = process.platform === "win32" ? "C:\\Windows\\system.ini" : "/etc/passwd";
  assert.equal(wm.containsPath(ws, outside), false);
});

test("safeResolve throws on traversal", () => {
  const ws = path.join(os.tmpdir(), "momor-ws-test");
  const abs = wm.safeResolve(ws, "docs/report.md");
  assert.ok(abs.startsWith(path.resolve(ws)));
  assert.throws(() => wm.safeResolve(ws, "../secrets.txt"), /escapes/);
});

test("resolveWorkspace (per-meeting) creates an isolated folder per meeting id", () => {
  const a = wm.resolveWorkspace(
    { workspaceStrategy: "per-meeting" },
    { id: "mtg-aaaaaaaa", title: "Sprint Planning" },
  );
  const b = wm.resolveWorkspace(
    { workspaceStrategy: "per-meeting" },
    { id: "mtg-bbbbbbbb", title: "Sprint Planning" },
  );
  assert.notEqual(a, b);
  assert.ok(fs.existsSync(a));
  assert.ok(fs.existsSync(b));
  assert.match(path.basename(a), /sprint-planning/i);
});

test("resolveWorkspace (custom) rejects protected system dirs", () => {
  const denied = process.platform === "win32" ? (process.env.SystemRoot || "C:\\Windows") : "/etc";
  assert.throws(
    () => wm.resolveWorkspace({ workspaceStrategy: "custom", customWorkspacePath: denied }),
    /protected system directory/,
  );
  // Home directory itself is denied (too broad a blast radius).
  assert.throws(
    () => wm.resolveWorkspace({ workspaceStrategy: "custom", customWorkspacePath: os.homedir() }),
    /protected system directory/,
  );
});

test("resolveWorkspace (custom) accepts a normal project folder", () => {
  const target = path.join(os.tmpdir(), "momor-custom-ws");
  const out = wm.resolveWorkspace({ workspaceStrategy: "custom", customWorkspacePath: target });
  assert.equal(path.resolve(out), path.resolve(target));
  assert.ok(fs.existsSync(out));
});

after(() => {
  for (const p of ["momor-custom-ws"]) {
    try { fs.rmSync(path.join(os.tmpdir(), p), { recursive: true, force: true }); } catch {}
  }
});
