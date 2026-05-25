// electron/services/__tests__/UserSessionContextService.test.mjs
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesDir = path.resolve(
  __dirname,
  "../../../dist-electron/electron/services",
);

async function loadService() {
  const modulePath = path.join(servicesDir, "UserSessionContextService.js");
  return import(pathToFileURL(modulePath).href);
}

describe("UserSessionContextService", () => {
  let UserSessionContextService;

  beforeEach(async () => {
    const mod = await loadService();
    UserSessionContextService = mod.UserSessionContextService;
    UserSessionContextService.instance = null;
  });

  test("buildContextBlock includes personal, session, and profile rules", () => {
    const svc = UserSessionContextService.getInstance();
    svc.sync({
      personalContext: "Senior backend engineer, 8 years Go.",
      sessionContext: "Technical interview for Staff role.",
      profiles: [
        {
          id: "p1",
          name: "Interview",
          behaviorPrompt: "Be concise and confident.",
          isDefault: true,
        },
      ],
      activeProfileId: "p1",
    });

    const block = svc.buildContextBlock();
    assert.match(block, /## About the user/);
    assert.match(block, /Senior backend engineer/);
    assert.match(block, /## Current session/);
    assert.match(block, /Staff role/);
    assert.match(block, /## AI behavior rules/);
    assert.match(block, /Be concise and confident/);
  });

  test("mergeIfNeeded avoids duplicating renderer-provided context", () => {
    const svc = UserSessionContextService.getInstance();
    svc.sync({
      personalContext: "PM with fintech background",
      sessionContext: "",
      profiles: [{ id: "d", name: "Default", behaviorPrompt: "", isDefault: true }],
      activeProfileId: "d",
    });

    const rendererBlock = "## About the user\nPM with fintech background";
    const merged = svc.mergeIfNeeded(rendererBlock);
    assert.equal(merged, rendererBlock);
  });

  test("mergeWithContext prepends user block before conversation", () => {
    const svc = UserSessionContextService.getInstance();
    svc.sync({
      personalContext: "Uses STAR format.",
      sessionContext: "",
      profiles: [{ id: "d", name: "Default", behaviorPrompt: "", isDefault: true }],
      activeProfileId: "d",
    });

    const merged = svc.mergeWithContext("[ME] Hello");
    assert.match(merged, /^## About the user/);
    assert.match(merged, /CONVERSATION:\n\[ME\] Hello/);
  });
});
