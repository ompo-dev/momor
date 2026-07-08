// Tests run against the esbuild-compiled LocalPathAccess helper in dist-electron/.
// Run via: npm run build:electron && node --test electron/services/__tests__/

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.resolve(
  __dirname,
  "../../../dist-electron/electron/services/agent/LocalPathAccess.js",
);
const {
  extractLatestUserTurnText,
  extractPathTargetsFromText,
  hasExplicitPathReference,
  isGenericLocalAccessDisclaimer,
  pickExplicitWorkspaceDir,
  shouldPromoteToAgentTurn,
} = await import(pathToFileURL(compiled).href);

test("extractLatestUserTurnText keeps only the latest user question block", () => {
  const text =
    'CONTEXT:\nold "C:\\\\tmp\\\\ignore.txt"\n\nUSER QUESTION:\nRead "C:\\\\tmp\\\\keep.txt"';
  assert.equal(
    extractLatestUserTurnText(text),
    'Read "C:\\\\tmp\\\\keep.txt"',
  );
});

test("extractPathTargetsFromText returns real absolute path targets", () => {
  const dir = path.join(os.tmpdir(), "momor-local-path-access");
  const file = path.join(dir, "README.md");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, "# test\n", "utf8");

  const targets = extractPathTargetsFromText(`Summarize "${file}"`);
  assert.equal(targets.length, 1);
  assert.equal(path.resolve(targets[0].targetPath), path.resolve(file));
  assert.equal(path.resolve(targets[0].accessDir), path.resolve(dir));

  fs.rmSync(dir, { recursive: true, force: true });
});

test("extractPathTargetsFromText recognizes a natural-language Windows prompt with a quoted file path", () => {
  const dir = path.join(os.tmpdir(), "momor-local-path-natural");
  const file = path.join(dir, "README.md");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, "# test\n", "utf8");

  const targets = extractPathTargetsFromText(
    `sobre o que fala este arquivo? "${file}"`,
  );
  assert.equal(targets.length, 1);
  assert.equal(path.resolve(targets[0].targetPath), path.resolve(file));
  assert.equal(path.resolve(targets[0].accessDir), path.resolve(dir));

  fs.rmSync(dir, { recursive: true, force: true });
});

test("hasExplicitPathReference only flips on for real absolute local paths", () => {
  assert.equal(hasExplicitPathReference("resuma este projeto para mim"), false);

  const dir = path.join(os.tmpdir(), "momor-local-path-explicit");
  const file = path.join(dir, "README.md");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, "# test\n", "utf8");

  assert.equal(hasExplicitPathReference(`sobre o que fala este arquivo? "${file}"`), true);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("shouldPromoteToAgentTurn recognizes skill and MCP requests even without a path", () => {
  assert.equal(shouldPromoteToAgentTurn("/skills liste as skills disponiveis"), true);
  assert.equal(shouldPromoteToAgentTurn("@mcps mostre os mcps ativos"), true);
});

test("shouldPromoteToAgentTurn recognizes natural-language file and project operations", () => {
  assert.equal(
    shouldPromoteToAgentTurn("read the project files and summarize this workspace"),
    true,
  );
  assert.equal(
    shouldPromoteToAgentTurn("edite os arquivos do projeto e crie uma pasta nova"),
    true,
  );
  assert.equal(shouldPromoteToAgentTurn("como voce esta hoje?"), false);
});

test("isGenericLocalAccessDisclaimer catches bad generic permission disclaimers in EN/PT", () => {
  assert.equal(
    isGenericLocalAccessDisclaimer(
      "I don't have permission to read that file right now. Please paste it here.",
    ),
    true,
  );
  assert.equal(
    isGenericLocalAccessDisclaimer(
      "Nao tenho permissao para ler esse arquivo no momento. Voce pode colar o conteudo aqui?",
    ),
    true,
  );
  assert.equal(
    isGenericLocalAccessDisclaimer(
      "N\u00e3o tenho permiss\u00e3o para ler esse arquivo no momento. Voc\u00ea pode colar o conte\u00fado aqui?",
    ),
    true,
  );
  assert.equal(
    isGenericLocalAccessDisclaimer(
      "Li o README e ele descreve a arquitetura do projeto.",
    ),
    false,
  );
});

test("pickExplicitWorkspaceDir only chooses a workspace when all paths share one root", () => {
  const dir = path.join(os.tmpdir(), "momor-local-path-root");
  const same = [
    { targetPath: path.join(dir, "a.md"), accessDir: dir },
    { targetPath: path.join(dir, "b.md"), accessDir: dir },
  ];
  const picked = pickExplicitWorkspaceDir(same);
  assert.ok(picked);
  assert.equal(path.resolve(picked), path.resolve(dir));

  const mixed = [
    { targetPath: path.join(os.tmpdir(), "a", "x.md"), accessDir: path.join(os.tmpdir(), "a") },
    { targetPath: path.join(os.tmpdir(), "b", "y.md"), accessDir: path.join(os.tmpdir(), "b") },
  ];
  assert.equal(pickExplicitWorkspaceDir(mixed), undefined);
});
