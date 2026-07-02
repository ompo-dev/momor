import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "momor-openclaude-config-"),
);
const fakeHome = path.join(tempRoot, "home");
const fakeProject = path.join(tempRoot, "project");

fs.mkdirSync(fakeHome, { recursive: true });
fs.mkdirSync(fakeProject, { recursive: true });

const originalEnv = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
  MOMOR_OPENCLAUDE_PROJECT_DIR: process.env.MOMOR_OPENCLAUDE_PROJECT_DIR,
};

process.env.HOME = fakeHome;
process.env.USERPROFILE = fakeHome;
delete process.env.CLAUDE_CONFIG_DIR;
process.env.MOMOR_OPENCLAUDE_PROJECT_DIR = fakeProject;

fs.writeFileSync(
  path.join(fakeHome, ".claude.json"),
  JSON.stringify(
    {
      mcpServers: {
        globalOnly: { command: "npx", args: ["-y", "global-only"] },
        shared: { command: "npx", args: ["-y", "global-shared"] },
      },
    },
    null,
    2,
  ),
  "utf8",
);

fs.writeFileSync(
  path.join(fakeProject, ".mcp.json"),
  JSON.stringify(
    {
      mcpServers: {
        projectOnly: { type: "http", url: "http://127.0.0.1:7878/mcp" },
        shared: { command: "bunx", args: ["project-shared"] },
      },
    },
    null,
    2,
  ),
  "utf8",
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.resolve(
  __dirname,
  "../../../dist-electron/electron/openclaude/OpenClaudeConfig.js",
);
const { OpenClaudeConfig } = await import(pathToFileURL(compiled).href);
const config = OpenClaudeConfig.getInstance();

test("OpenClaudeConfig merges global ~/.claude.json and project .mcp.json", () => {
  const byName = new Map(
    config.listMcpServers().map((server) => [server.name, server]),
  );

  assert.equal(byName.get("globalOnly")?.command, "npx");
  assert.equal(
    byName.get("projectOnly")?.url,
    "http://127.0.0.1:7878/mcp",
  );
  assert.equal(byName.get("shared")?.command, "bunx");
  assert.deepEqual(byName.get("shared")?.args, ["project-shared"]);
});

test("OpenClaudeConfig updates existing project MCP entries in place and writes new ones globally", () => {
  config.installMcpServer("shared", {
    command: "node",
    args: ["project-updated"],
  });
  config.installMcpServer("brandNew", {
    command: "npx",
    args: ["-y", "brand-new"],
  });

  const projectJson = JSON.parse(
    fs.readFileSync(path.join(fakeProject, ".mcp.json"), "utf8"),
  );
  const globalJson = JSON.parse(
    fs.readFileSync(path.join(fakeHome, ".claude.json"), "utf8"),
  );

  assert.equal(projectJson.mcpServers.shared.command, "node");
  assert.deepEqual(projectJson.mcpServers.shared.args, ["project-updated"]);
  assert.equal(globalJson.mcpServers.shared.command, "npx");
  assert.equal(globalJson.mcpServers.brandNew.command, "npx");
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch {}
});
