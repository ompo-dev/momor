// electron/services/__tests__/LiveMeetingContext.test.mjs
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesDir = path.resolve(
  __dirname,
  "../../../dist-electron/electron/services",
);

async function loadModule() {
  const modulePath = path.join(servicesDir, "LiveMeetingContext.js");
  return import(pathToFileURL(modulePath).href);
}

describe("LiveMeetingContext", () => {
  test("mergeLiveMeetingTranscriptIntoContext prepends transcript when context empty", async () => {
    const { mergeLiveMeetingTranscriptIntoContext, LIVE_MEETING_TRANSCRIPT_HEADER } =
      await loadModule();
    const merged = mergeLiveMeetingTranscriptIntoContext(
      undefined,
      "[ME]: 4 9 2",
    );
    assert.ok(merged.includes(LIVE_MEETING_TRANSCRIPT_HEADER));
    assert.match(merged, /\[ME\]: 4 9 2/);
  });

  test("mergeLiveMeetingTranscriptIntoContext appends to user profile context", async () => {
    const { mergeLiveMeetingTranscriptIntoContext } = await loadModule();
    const profileBlock = "## About the user\nMaicon, engenheiro front-end";
    const merged = mergeLiveMeetingTranscriptIntoContext(
      profileBlock,
      "[ME]: 1 7 5",
    );
    assert.match(merged, /## About the user/);
    assert.match(merged, /\[ME\]: 1 7 5/);
  });

  test("mergeLiveMeetingTranscriptIntoContext does not duplicate existing transcript", async () => {
    const { mergeLiveMeetingTranscriptIntoContext, LIVE_MEETING_TRANSCRIPT_HEADER } =
      await loadModule();
    const existing = `${LIVE_MEETING_TRANSCRIPT_HEADER}\n[ME]: already here`;
    const merged = mergeLiveMeetingTranscriptIntoContext(existing, "[ME]: new");
    assert.equal(merged, existing);
  });
});
