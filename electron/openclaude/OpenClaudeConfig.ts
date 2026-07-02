/**
 * OpenClaudeConfig — reads and writes the skills / MCP servers that openclaude
 * (a Claude Code fork) loads natively, so Momor's home can reflect them and the
 * chat can use them. openclaude reads from the Claude config home:
 *   - config dir:  $CLAUDE_CONFIG_DIR  ||  ~/.claude
 *   - skills:      <config>/skills/<name>/SKILL.md   (YAML frontmatter + body)
 *   - MCP servers: ~/.claude.json  +  <project>/.mcp.json
 *
 * These shapes mirror Momor's own DB rows (Skill / McpServer in DatabaseManager)
 * so the two registries merge by name — openclaude is the canonical source.
 *
 * Project MCP discovery uses this order:
 *   1. MOMOR_OPENCLAUDE_PROJECT_DIR
 *   2. agentCli.customWorkspacePath when workspaceStrategy === "custom"
 *   3. process.cwd() when a local .mcp.json exists there
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface OpenClaudeSkill {
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  source: "openclaude";
}

export interface OpenClaudeMcpServer {
  name: string;
  transport: "stdio" | "sse" | "http";
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  source: "openclaude";
}

export class OpenClaudeConfig {
  private static instance: OpenClaudeConfig | null = null;

  static getInstance(): OpenClaudeConfig {
    if (!OpenClaudeConfig.instance) {
      OpenClaudeConfig.instance = new OpenClaudeConfig();
    }
    return OpenClaudeConfig.instance;
  }

  /** Claude/openclaude config home. */
  configDir(): string {
    const override = process.env.CLAUDE_CONFIG_DIR?.trim();
    return override || path.join(os.homedir(), ".claude");
  }

  private skillsDir(): string {
    return path.join(this.configDir(), "skills");
  }

  private globalConfigFile(): string {
    return path.join(os.homedir(), ".claude.json");
  }

  private projectRoot(): string | null {
    const envOverride = process.env.MOMOR_OPENCLAUDE_PROJECT_DIR?.trim();
    if (envOverride) {
      return path.resolve(envOverride);
    }

    try {
      const { SettingsManager } = require("../services/SettingsManager");
      const agentCli = SettingsManager.getInstance().get("agentCli");
      if (
        agentCli?.workspaceStrategy === "custom" &&
        typeof agentCli.customWorkspacePath === "string" &&
        agentCli.customWorkspacePath.trim()
      ) {
        return path.resolve(agentCli.customWorkspacePath.trim());
      }
    } catch {
      // SettingsManager is not always available in isolated tests / early boot.
    }

    try {
      const cwd = process.cwd();
      if (cwd && fs.existsSync(path.join(cwd, ".mcp.json"))) {
        return path.resolve(cwd);
      }
    } catch {
      // Ignore cwd detection failures and fall back to global-only config.
    }

    return null;
  }

  private projectConfigFile(): string | null {
    const root = this.projectRoot();
    return root ? path.join(root, ".mcp.json") : null;
  }

  private mcpConfigFiles(): string[] {
    const files = [this.globalConfigFile(), this.projectConfigFile()].filter(
      (file): file is string => Boolean(file),
    );
    return [...new Set(files)];
  }

  // ── Skills ──────────────────────────────────────────────────────────────

  listSkills(): OpenClaudeSkill[] {
    const dir = this.skillsDir();
    if (!fs.existsSync(dir)) return [];
    const out: OpenClaudeSkill[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(dir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;
      try {
        const raw = fs.readFileSync(skillFile, "utf8");
        const { createdAt, updatedAt } = statTimestamps(skillFile);
        const { name, description, body } = parseSkillMd(raw, entry.name);
        out.push({
          name,
          description,
          content: body,
          enabled: true,
          createdAt,
          updatedAt,
          source: "openclaude",
        });
      } catch {
        /* skip malformed skill */
      }
    }
    return out;
  }

  /** Create or overwrite a skill as <config>/skills/<name>/SKILL.md. */
  installSkill(input: {
    name: string;
    description?: string;
    content: string;
  }): void {
    const slug = slugify(input.name);
    const dir = path.join(this.skillsDir(), slug);
    fs.mkdirSync(dir, { recursive: true });
    const frontmatter =
      `---\n` +
      `name: ${input.name}\n` +
      `description: ${(input.description ?? "").replace(/\n/g, " ")}\n` +
      `---\n\n`;
    fs.writeFileSync(path.join(dir, "SKILL.md"), frontmatter + input.content, "utf8");
  }

  removeSkill(name: string): boolean {
    const dir = this.findSkillDir(name);
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  // ── MCP servers ────────────────────────────────────────────────────────

  listMcpServers(): OpenClaudeMcpServer[] {
    const merged = new Map<string, OpenClaudeMcpServer>();

    for (const file of this.mcpConfigFiles()) {
      if (!fs.existsSync(file)) continue;
      const json = readJsonFile(file);
      const servers = json?.mcpServers;
      if (!servers || typeof servers !== "object") continue;
      const timestamps = statTimestamps(file);
      for (const [name, cfg] of Object.entries(servers)) {
        merged.set(normalizeName(name), normalizeMcp(name, cfg, timestamps));
      }
    }

    return [...merged.values()];
  }

  /** Merge one MCP server into ~/.claude.json (create the file if missing). */
  installMcpServer(
    name: string,
    config:
      | { command: string; args?: string[]; env?: Record<string, string> }
      | { type: "sse" | "http"; url: string },
  ): void {
    const file = this.findExistingMcpServerFile(name) ?? this.globalConfigFile();
    const json = readJsonFile(file) ?? {};
    json.mcpServers = { ...(json.mcpServers ?? {}), [name]: config };
    ensureParentDir(file);
    fs.writeFileSync(file, JSON.stringify(json, null, 2), "utf8");
  }

  removeMcpServer(name: string): boolean {
    let removed = false;
    for (const file of this.mcpConfigFiles()) {
      removed = this.removeMcpServerFromFile(file, name) || removed;
    }
    return removed;
  }

  private findSkillDir(name: string): string {
    const direct = path.join(this.skillsDir(), slugify(name));
    if (fs.existsSync(direct)) return direct;

    const dir = this.skillsDir();
    if (!fs.existsSync(dir)) return direct;

    const target = normalizeName(name);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(dir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;
      try {
        const raw = fs.readFileSync(skillFile, "utf8");
        const parsed = parseSkillMd(raw, entry.name);
        if (normalizeName(parsed.name) === target) {
          return path.join(dir, entry.name);
        }
      } catch {
        /* skip malformed skill */
      }
    }

    return direct;
  }

  private findExistingMcpServerFile(name: string): string | null {
    const target = normalizeName(name);
    const projectFile = this.projectConfigFile();
    if (projectFile) {
      const projectServers = readJsonFile(projectFile)?.mcpServers;
      if (projectServers && typeof projectServers === "object") {
        for (const existingName of Object.keys(projectServers)) {
          if (normalizeName(existingName) === target) {
            return projectFile;
          }
        }
      }
    }

    const globalFile = this.globalConfigFile();
    const globalServers = readJsonFile(globalFile)?.mcpServers;
    if (globalServers && typeof globalServers === "object") {
      for (const existingName of Object.keys(globalServers)) {
        if (normalizeName(existingName) === target) {
          return globalFile;
        }
      }
    }

    return null;
  }

  private removeMcpServerFromFile(file: string, name: string): boolean {
    if (!fs.existsSync(file)) return false;
    const json = readJsonFile(file);
    const servers = json?.mcpServers;
    if (!servers || typeof servers !== "object") return false;

    const target = Object.keys(servers).find(
      (existingName) => normalizeName(existingName) === normalizeName(name),
    );
    if (!target) return false;

    delete servers[target];
    ensureParentDir(file);
    fs.writeFileSync(file, JSON.stringify(json, null, 2), "utf8");
    return true;
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function parseSkillMd(
  raw: string,
  fallbackName: string,
): { name: string; description: string; body: string } {
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fm) {
    return { name: fallbackName, description: "", body: raw.trim() };
  }
  const meta = fm[1];
  const body = fm[2].trim();
  const nameM = meta.match(/^name:\s*(.+)$/m);
  const descM = meta.match(/^description:\s*(.+)$/m);
  return {
    name: nameM ? nameM[1].trim() : fallbackName,
    description: descM ? descM[1].trim() : "",
    body,
  };
}

function normalizeMcp(
  name: string,
  cfg: any,
  timestamps: { createdAt: string; updatedAt: string },
): OpenClaudeMcpServer {
  const isUrl = typeof cfg?.url === "string";
  const transport: OpenClaudeMcpServer["transport"] = isUrl
    ? cfg.type === "http"
      ? "http"
      : "sse"
    : "stdio";
  return {
    name,
    transport,
    command: typeof cfg?.command === "string" ? cfg.command : null,
    args: Array.isArray(cfg?.args) ? cfg.args : [],
    env: normalizeEnv(cfg?.env),
    url: isUrl ? cfg.url : null,
    enabled: true,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    source: "openclaude",
  };
}

function normalizeEnv(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key) continue;
    out[key] = String(value ?? "");
  }
  return out;
}

function readJsonFile(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function statTimestamps(filePath: string): { createdAt: string; updatedAt: string } {
  try {
    const stat = fs.statSync(filePath);
    return {
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    const now = new Date().toISOString();
    return { createdAt: now, updatedAt: now };
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "skill";
}
