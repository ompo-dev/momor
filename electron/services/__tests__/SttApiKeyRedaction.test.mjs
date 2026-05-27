import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('get-stored-credentials returns full LLM api key lists for settings UI', () => {
  const source = read('electron/ipcHandlers.ts');
  const handlerStart = source.indexOf('safeHandle("get-stored-credentials"');
  assert.ok(handlerStart >= 0, 'get-stored-credentials handler should exist');
  const nextHandler = source.indexOf('safeHandle("', handlerStart + 10);
  const handler = source.slice(handlerStart, nextHandler === -1 ? source.length : nextHandler);

  assert.match(handler, /geminiApiKeys:\s*cm\.getLlmApiKeysList\("gemini"\)/);
  assert.match(handler, /deepseekApiKeys:\s*cm\.getLlmApiKeysList\("deepseek"\)/);
});

test('STT profiles IPC exposes apiKeys array for settings UI', () => {
  const sttProfiles = read('electron/services/sttProfiles.ts');
  assert.match(sttProfiles, /exposeSttProfilesForSettings/);
  assert.match(sttProfiles, /apiKeys/);
});
