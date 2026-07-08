import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.resolve(
  __dirname,
  "../../../dist-electron/electron/openclaude/OpenClaudeEnv.js",
);

const {
  buildOpenClaudeEnv,
  DEEPSEEK_BASE_URL,
} = await import(pathToFileURL(compiled).href);

test("buildOpenClaudeEnv keeps OpenAI-compatible routing without forcing an empty API key", () => {
  const env = buildOpenClaudeEnv({
    provider: "deepseek",
    model: "deepseek-chat",
  });

  assert.equal(env.CLAUDE_CODE_USE_OPENAI, "1");
  assert.equal(env.OPENAI_BASE_URL, DEEPSEEK_BASE_URL);
  assert.equal(env.OPENAI_MODEL, "deepseek-chat");
  assert.ok(!("OPENAI_API_KEY" in env));
});

test("buildOpenClaudeEnv omits blank auth env values for anthropic and gemini", () => {
  const anthropic = buildOpenClaudeEnv({
    provider: "anthropic",
    apiKey: "   ",
    model: "claude-sonnet-4-6",
  });
  const gemini = buildOpenClaudeEnv({
    provider: "gemini",
    apiKey: "",
    model: "gemini-3.1-flash-lite-preview",
  });

  assert.equal(anthropic.ANTHROPIC_MODEL, "claude-sonnet-4-6");
  assert.ok(!("ANTHROPIC_API_KEY" in anthropic));
  assert.equal(gemini.CLAUDE_CODE_USE_GEMINI, "1");
  assert.equal(gemini.GEMINI_MODEL, "gemini-3.1-flash-lite-preview");
  assert.ok(!("GEMINI_API_KEY" in gemini));
});
