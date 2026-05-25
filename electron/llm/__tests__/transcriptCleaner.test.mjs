// electron/llm/__tests__/transcriptCleaner.test.mjs
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const llmDir = path.resolve(__dirname, "../../../dist-electron/electron/llm");

async function loadCleaner() {
  const modulePath = path.join(llmDir, "transcriptCleaner.js");
  return import(pathToFileURL(modulePath).href);
}

describe("transcriptCleaner", () => {
  test("prepareTranscriptForWhatToAnswer keeps short spoken numbers", async () => {
    const { prepareTranscriptForWhatToAnswer } = await loadCleaner();
    const formatted = prepareTranscriptForWhatToAnswer([
      {
        role: "user",
        text: "7 9 1",
        timestamp: Date.now() - 5000,
      },
      {
        role: "user",
        text: "agora vou falar 3 numeros aleatorio",
        timestamp: Date.now() - 3000,
      },
      {
        role: "user",
        text: "quais eu falei?",
        timestamp: Date.now() - 1000,
      },
    ]);

    assert.match(formatted, /\[ME\]: 7 9 1/);
    assert.match(formatted, /3 numeros/);
  });

  test("resolveTranscriptForWhatToAnswer prefers raw when cleaning dropped content", async () => {
    const { resolveTranscriptForWhatToAnswer } = await loadCleaner();
    const raw = "[ME]: 7 9\n[ME]: 1 7 e 9\n[ME]: oi";
    const prepared = "[ME]: agora vou falar 3 numeros";
    const resolved = resolveTranscriptForWhatToAnswer(raw, prepared);
    assert.equal(resolved, raw);
  });
});
