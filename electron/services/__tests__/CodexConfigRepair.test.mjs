// Verifies ensureCodexConfig repairs the invalid service_tier that blocks codex
// ("Error loading config.toml: unknown variant `default`").
// Run via: npm run build:electron && node --test electron/services/__tests__/

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.resolve(
  __dirname,
  "../../../dist-electron/electron/services/CodexCliService.js",
);
const { CodexCliService } = await import(pathToFileURL(compiled).href);

const configPath = path.join(os.homedir(), ".codex", "config.toml");
let saved = null;

beforeEach(() => {
  saved = fs.existsSync(configPath) ? fs.readFileSync(configPath) : null;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
});
afterEach(() => {
  if (saved !== null) fs.writeFileSync(configPath, saved);
  else { try { fs.unlinkSync(configPath); } catch {} }
  try { fs.unlinkSync(configPath + ".bak"); } catch {}
});

test('ensureCodexConfig strips invalid service_tier = "default"', () => {
  fs.writeFileSync(
    configPath,
    'model = "gpt-5.4"\nservice_tier = "default"\napproval_policy = "never"\n',
    "utf8",
  );
  CodexCliService.ensureCodexConfig();
  const after = fs.readFileSync(configPath, "utf8");
  assert.ok(!/service_tier/.test(after), "invalid service_tier must be removed");
  assert.match(after, /model = "gpt-5.4"/, "valid keys must be preserved");
  assert.match(after, /approval_policy = "never"/, "other keys preserved");
  assert.ok(fs.existsSync(configPath + ".bak"), "a backup must be written");
});

test("ensureCodexConfig leaves a valid config untouched", () => {
  const good = 'model = "gpt-5.4"\nservice_tier = "flex"\n';
  fs.writeFileSync(configPath, good, "utf8");
  CodexCliService.ensureCodexConfig();
  assert.equal(fs.readFileSync(configPath, "utf8"), good);
  assert.ok(!fs.existsSync(configPath + ".bak"), "no backup for a healthy config");
});
