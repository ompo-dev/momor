import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('custom provider execution no longer happens directly inside LLMHelper', () => {
  const source = read('electron/LLMHelper.ts');

  assert.equal(
    source.includes('public async chatWithCurl('),
    false,
    'legacy direct cURL execution should be removed from LLMHelper',
  );
  assert.equal(
    source.includes('private async *streamWithCustom('),
    false,
    'legacy custom-provider streaming path should be removed from LLMHelper',
  );
  assert.equal(
    source.includes('executeCustomProvider('),
    false,
    'LLMHelper should not execute custom provider requests directly anymore',
  );
  assert.ok(
    source.includes('extractOpenClaudeCurlConfig('),
    'custom provider configs should still be parsed for OpenClaude env wiring',
  );
});

test('extractOpenClaudeCurlConfig is parse-only and does not issue network calls', () => {
  const source = read('electron/LLMHelper.ts');

  const start = source.indexOf('private extractOpenClaudeCurlConfig(');
  assert.ok(start >= 0, 'extractOpenClaudeCurlConfig should exist');

  const end = source.indexOf('\n  private resolveOpenClaudeInvocation(', start);
  assert.ok(end > start, 'extractOpenClaudeCurlConfig should end before resolveOpenClaudeInvocation');

  const body = source.slice(start, end);

  assert.ok(body.includes('curl2Json('), 'the helper should parse the cURL command');
  assert.equal(body.includes('axios('), false, 'the helper should not call axios');
  assert.equal(body.includes('fetch('), false, 'the helper should not call fetch');
});

test('curlUtils exports SSRF URL validation helper', () => {
  const source = read('electron/utils/curlUtils.ts');

  assert.match(
    source,
    /export function validateUrlForSsrf/,
    'validateUrlForSsrf should remain available for cURL validation flows',
  );
});

test('validateUrlForSsrf source covers private, loopback, and unsafe URL patterns', () => {
  const source = read('electron/utils/curlUtils.ts');

  const requiredSnippets = [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    '169.254.',
    "hostname.startsWith('10.')",
    "hostname.startsWith('192.168.')",
    'secondOctet >= 16 && secondOctet <= 31',
    "urlString.startsWith('//')",
    "urlString.toLowerCase().startsWith('data:')",
    "urlString.toLowerCase().startsWith('file:')",
    "urlString.toLowerCase().startsWith('javascript:')",
    "url.protocol !== 'https:'",
    "urlString.includes('/../')",
  ];

  for (const snippet of requiredSnippets) {
    assert.ok(
      source.includes(snippet),
      `validateUrlForSsrf should cover ${snippet}`,
    );
  }
});
