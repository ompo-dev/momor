import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

async function loadRouter() {
  const routerPath = path.resolve(
    __dirname,
    "../../../dist-electron/electron/llm/ProviderRouter.js",
  );
  return import(pathToFileURL(routerPath).href);
}

test("assertProviderDataScopes throws ProviderScopeError when a denied scope is requested", async () => {
  const { assertProviderDataScopes, ProviderScopeError } = await loadRouter();

  assert.throws(
    () =>
      assertProviderDataScopes("openai", ["transcript"], { transcript: false }),
    (err) =>
      err instanceof ProviderScopeError &&
      err.deniedScopes.includes("transcript"),
  );
});

test("assertProviderDataScopes is a no-op when scopes are allowed or unset", async () => {
  const { assertProviderDataScopes } = await loadRouter();

  assert.doesNotThrow(() =>
    assertProviderDataScopes("openai", ["transcript"], { transcript: true }),
  );
  assert.doesNotThrow(() =>
    assertProviderDataScopes("openai", ["transcript"], {}),
  );
  assert.doesNotThrow(() =>
    assertProviderDataScopes("openai", ["transcript"], undefined),
  );
  assert.doesNotThrow(() =>
    assertProviderDataScopes("openai", [], { transcript: false }),
  );
});

test("routeLLMProviders marks all providers unavailable when scope is denied", async () => {
  const { routeLLMProviders } = await loadRouter();

  const attempts = routeLLMProviders({
    capability: "chat",
    availability: { hasOpenAI: true, hasGroq: true, hasGemini: true },
    dataScopes: ["transcript"],
    scopePolicy: { transcript: false },
  });

  for (const attempt of attempts) {
    assert.equal(
      attempt.status,
      "unavailable",
      `${attempt.provider} should be unavailable`,
    );
    assert.equal(attempt.unavailableReason, "disabled");
  }
});

test("routeLLMProviders keeps providers available when scopes are allowed", async () => {
  const { routeLLMProviders } = await loadRouter();

  const attempts = routeLLMProviders({
    capability: "chat",
    availability: { hasOpenAI: true, hasGroq: true, hasGemini: true },
    dataScopes: ["transcript"],
    scopePolicy: { transcript: true },
  });

  const available = attempts.filter((a) => a.status === "available");
  assert.ok(
    available.length > 0,
    "expected at least one provider to be available",
  );
});

test("LLMHelper guards outbound OpenClaude turns with assertOutboundScopes", () => {
  const src = read("electron/LLMHelper.ts");

  assert.match(src, /this\.assertOutboundScopes\(/);
  assert.match(src, /invocation\.scopeProvider/);
});

test("LLMHelper routes chat through OpenClaude instead of routeLLMProviders fallback rotation", () => {
  const src = read("electron/LLMHelper.ts");

  assert.doesNotMatch(src, /routeLLMProviders\(/);
  assert.match(src, /yield\* this\.streamWithOpenClaude\(/);
});

test("LLMHelper exposes a shared OpenClaude agent-turn resolver for overlay and agent IPC", () => {
  const src = read("electron/LLMHelper.ts");

  assert.match(src, /public prepareOpenClaudeAgentTurn\(/);
  assert.match(src, /this\.resolveOpenClaudeInvocationForModelId\(modelId\)/);
  assert.match(src, /this\.assertOutboundScopes\(/);
});

test("Embedding provider resolver fails closed when embeddings scope is denied", () => {
  const src = read("electron/rag/EmbeddingProviderResolver.ts");

  assert.match(
    src,
    /assertProviderDataScopes\('openai_embeddings', \['embeddings'\], config\.providerDataScopes\)/,
  );
  assert.match(
    src,
    /assertProviderDataScopes\('gemini_embeddings', \['embeddings'\], config\.providerDataScopes\)/,
  );
});

test("RAGManager forwards providerDataScopes from config and runtime keys", () => {
  const src = read("electron/rag/RAGManager.ts");

  assert.match(src, /providerDataScopes\?: ProviderDataScopePolicy/);
  assert.match(src, /providerDataScopes: config\.providerDataScopes/);
});

test("SettingsManager exposes providerDataScopes setting", () => {
  const src = read("electron/services/SettingsManager.ts");

  assert.match(src, /providerDataScopes\?:\s*\{[\s\S]+transcript\?: boolean;/);
  assert.match(src, /post_call_summary\?: boolean;/);
});

test("IPC handlers expose get/set provider-data-scopes and broadcast updates", () => {
  const ipc = read("electron/ipcHandlers.ts");

  assert.match(ipc, /safeHandle\("get-provider-data-scopes"/);
  assert.match(ipc, /safeHandle\(\s*"set-provider-data-scopes"/);
  assert.match(
    ipc,
    /webContents\.send\("provider-data-scopes-changed", sanitized\)/,
  );
  assert.match(
    ipc,
    /SettingsManager\.getInstance\(\)\.set\("providerDataScopes"/,
  );
});

test("agent IPC resolves OpenClaude provider env and skips stale saved CLI paths", () => {
  const ipc = read("electron/ipcHandlers.ts");

  assert.match(ipc, /const isRunnableCliPath =/);
  assert.match(ipc, /isRunnableCliPath\(savedOpenClaudePath\)/);
  assert.match(ipc, /resolvedOpenClaudePath = resolveOpenClaudeCliPath\(\)/);
  assert.match(
    ipc,
    /if \(\s*resolvedOpenClaudePath &&\s*currentOpenClaudePath !== resolvedOpenClaudePath\s*\)/,
  );
  assert.match(ipc, /settingsManager\.set\("agentCli", \{/);
  assert.match(ipc, /prepareOpenClaudeAgentTurn\(/);
  assert.match(ipc, /providerEnv:\s*resolvedProviderEnv/);
  assert.match(
    ipc,
    /providerId === "openclaude"[\s\S]{0,80}\? payload\.model[\s\S]{0,80}: payload\.model \|\| settings\.model/,
  );
  assert.match(ipc, /resolvedModel = explicitModel \|\| invocation\.model/);
});

test("gemini chat IPC promotes tool-like requests to the local agent, not only explicit paths", () => {
  const ipc = read("electron/ipcHandlers.ts");
  const localPathAccess = read("electron/services/agent/LocalPathAccess.ts");

  assert.match(ipc, /getAgentTurnRouting/);
  assert.match(ipc, /shouldPromoteToAgentTurn/);
  assert.match(ipc, /buildPromotedAgentSystemPrompt/);
  assert.match(ipc, /explicitLocalPath/);
  assert.match(
    ipc,
    /Treat the referenced path as intentionally shared and already approved for this turn/i,
  );
  assert.match(ipc, /!explicitLocalPath && context\?\.trim\(\)/);
  assert.match(localPathAccess, /export function shouldPromoteToAgentTurn/);
  assert.match(localPathAccess, /AGENT_TOOL_REFERENCE_RE/);
});

test("agent orchestrator ignores garbled configured executable strings and falls back to sane commands", () => {
  const orchestrator = read("electron/services/agent/AgentOrchestrator.ts");

  assert.match(orchestrator, /resolveConfiguredExecutableCandidate/);
  assert.match(orchestrator, /isRunnableBareCommand/);
  assert.doesNotMatch(
    orchestrator,
    /return configured\?\.trim\(\) \|\| bare \|\| null/,
  );
});

test("agent orchestrator reuses the saved OpenClaude executable from Integrations before falling back", () => {
  const orchestrator = read("electron/services/agent/AgentOrchestrator.ts");

  assert.match(orchestrator, /resolveSavedOpenClaudeExecutableCandidate/);
  assert.match(orchestrator, /getOpenClaudeCliPath/);
});

test("preload and renderer types expose provider data scope controls", () => {
  const preload = read("electron/preload.ts");
  const types = read("src/types/electron.d.ts");

  assert.match(preload, /getProviderDataScopes:/);
  assert.match(preload, /setProviderDataScopes:/);
  assert.match(preload, /onProviderDataScopesChanged:/);
  assert.match(preload, /ipcRenderer\.invoke\("get-provider-data-scopes"\)/);
  assert.match(
    preload,
    /ipcRenderer\.invoke\("set-provider-data-scopes", scopes\)/,
  );

  assert.match(types, /getProviderDataScopes:\s*\(\)\s*=>\s*Promise/);
  assert.match(types, /setProviderDataScopes:\s*\(scopes:/);
});

test("GeneralSettingsTab wires provider data scope controls to real IPC", () => {
  const src = read("src/components/settings/GeneralSettingsTab.tsx");

  assert.match(
    src,
    /getProviderDataScopes\?\.\(\)\.then\(setProviderDataScopes\)/,
  );
  assert.match(src, /window\.electronAPI\?\.setProviderDataScopes\?\.\(next\)/);
  assert.match(src, /setProviderDataScopes\(next\)/);
});

test("main and ProcessingHelper hydrate ragManager.initializeEmbeddings with policy", () => {
  const main = read("electron/main.ts");
  const ph = read("electron/ProcessingHelper.ts");

  assert.match(main, /providerDataScopes/);
  assert.match(ph, /providerDataScopes/);
});

test("ProcessingHelper hydrates stored OpenClaude config on boot", () => {
  const ph = read("electron/ProcessingHelper.ts");
  const ipc = read("electron/ipcHandlers.ts");

  assert.match(ph, /setOpenClaudeConfig\(\{/);
  assert.match(ph, /getOpenClaudeCliPath\(\)/);
  assert.match(ph, /isOpenClaudeEnabled\(\)/);
  assert.match(ph, /getOpenClaudeModel\(\)/);
  assert.match(ph, /settingsManager\.set\("agentCli", \{/);
  assert.match(ph, /openclaude:\s*resolvedOpenClaudePath/);
  assert.match(ipc, /executablePaths\.openclaude = normalizedPath/);
});
