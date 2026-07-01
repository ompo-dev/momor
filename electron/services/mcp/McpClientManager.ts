// Native MCP client manager (provider-agnostic tool runtime).
//
// Connects to the user's enabled MCP servers (configured in the sidebar) using
// the official @modelcontextprotocol/sdk Client, aggregates their tools, and
// exposes them in OpenAI/Gemini tool-call formats so ANY provider's tool-use
// loop can call them through Momor — the same idea opencode/openclaude use.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface McpToolDef {
  /** Sanitized, namespaced name exposed to the LLM (e.g. "filesystem__read_file"). */
  callName: string;
  description: string;
  inputSchema: any; // JSON Schema
  serverId: string;
  serverName: string;
  toolName: string; // original tool name on the server
}

interface ConnectedServer {
  id: string;
  name: string;
  client: Client;
  tools: McpToolDef[];
}

const CONNECT_TIMEOUT_MS = 15_000;

/** OpenAI tool names must match ^[a-zA-Z0-9_-]{1,64}$. */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Notify renderer windows so the sidebar's skills/MCP lists refresh. */
function notifyWorkspace(): void {
  try {
    const { BrowserWindow } = require("electron");
    for (const w of BrowserWindow.getAllWindows()) {
      try {
        if (!w.isDestroyed()) w.webContents.send("abilities-updated");
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

function cleanYamlValue(s: string): string {
  return s.trim().replace(/^["']|["']$/g, "");
}

/** Parse a SKILL.md (YAML frontmatter + body) into a Momor skill. */
function parseSkillMarkdown(
  md: string,
  fallbackName: string,
): { name: string; description: string; content: string } {
  let name = fallbackName;
  let description = "";
  let content = md.trim();
  const fm = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/.exec(md);
  if (fm) {
    const yaml = fm[1];
    const nm = /(?:^|\n)name:\s*(.+)/i.exec(yaml);
    if (nm) name = cleanYamlValue(nm[1]);
    const dm = /(?:^|\n)description:\s*(.+)/i.exec(yaml);
    if (dm) description = cleanYamlValue(dm[1]);
    content = md.slice(fm[0].length).trim();
  }
  if (!description) {
    description = (content.split(/\n{2,}/)[0] || "")
      .replace(/^#+\s*/, "")
      .slice(0, 240);
  }
  return { name: name || fallbackName, description, content };
}

function repoNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if ((u.hostname === "github.com" || u.hostname.endsWith("githubusercontent.com")) && parts[1]) {
      return parts[1];
    }
  } catch {
    /* ignore */
  }
  return "skill";
}

/** Build raw candidate URLs to look for a SKILL.md/README given a GitHub or raw URL. */
function buildSkillCandidates(url: string): string[] {
  const out: string[] = [];
  try {
    const u = new URL(url);
    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const [owner, repo, kind, branch, ...rest] = parts;
      if (owner && repo) {
        if ((kind === "blob" || kind === "raw") && branch && rest.length) {
          out.push(
            `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`,
          );
        } else {
          const branches = kind === "tree" && branch ? [branch] : ["HEAD", "main", "master"];
          const dir = kind === "tree" && rest.length ? rest.join("/") + "/" : "";
          for (const b of branches) {
            for (const f of ["SKILL.md", "skill.md", "README.md", "readme.md"]) {
              out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${b}/${dir}${f}`);
            }
          }
        }
      }
    } else {
      out.push(url); // raw URL or any direct .md
    }
  } catch {
    /* ignore */
  }
  return out;
}

async function fetchAndParseSkill(
  url: string,
): Promise<{ name: string; description: string; content: string } | null> {
  const candidates = buildSkillCandidates(url);
  for (const c of candidates) {
    try {
      const res = await fetch(c, { redirect: "follow" } as any);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          return parseSkillMarkdown(text, repoNameFromUrl(url));
        }
      }
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export class McpClientManager {
  private static instance: McpClientManager;
  private servers = new Map<string, ConnectedServer>();
  private connecting: Promise<void> | null = null;

  static getInstance(): McpClientManager {
    if (!McpClientManager.instance) {
      McpClientManager.instance = new McpClientManager();
    }
    return McpClientManager.instance;
  }

  private getEnabledServerConfigs(): Array<{
    id: string;
    name: string;
    transport: "stdio" | "sse" | "http";
    command: string | null;
    args: string[];
    env: Record<string, string>;
    url: string | null;
  }> {
    try {
      const { DatabaseManager } = require("../../db/DatabaseManager");
      return DatabaseManager.getInstance()
        .getMcpServers()
        .filter((s: any) => s.enabled);
    } catch {
      return [];
    }
  }

  private makeTransport(cfg: {
    transport: "stdio" | "sse" | "http";
    command: string | null;
    args: string[];
    env: Record<string, string>;
    url: string | null;
  }) {
    if (cfg.transport === "stdio") {
      if (!cfg.command) throw new Error("stdio MCP server has no command");
      return new StdioClientTransport({
        command: cfg.command,
        args: cfg.args ?? [],
        env: { ...(process.env as Record<string, string>), ...(cfg.env ?? {}) },
      });
    }
    if (!cfg.url) throw new Error(`${cfg.transport} MCP server has no url`);
    const url = new URL(cfg.url);
    return cfg.transport === "http"
      ? new StreamableHTTPClientTransport(url)
      : new SSEClientTransport(url);
  }

  /** Connect any newly-enabled servers; drop disabled/removed ones. Idempotent. */
  async ensureConnections(): Promise<void> {
    if (this.connecting) return this.connecting;
    this.connecting = this._ensureConnections().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async _ensureConnections(): Promise<void> {
    const configs = this.getEnabledServerConfigs();
    const wantedIds = new Set(configs.map((c) => c.id));

    // Disconnect servers no longer enabled.
    for (const [id, srv] of [...this.servers.entries()]) {
      if (!wantedIds.has(id)) {
        try {
          await srv.client.close();
        } catch {
          /* ignore */
        }
        this.servers.delete(id);
      }
    }

    // Connect newly-enabled servers.
    for (const cfg of configs) {
      if (this.servers.has(cfg.id)) continue;
      try {
        const client = new Client(
          { name: "momor", version: "1.0.0" },
          { capabilities: {} },
        );
        const transport = this.makeTransport(cfg);
        await withTimeout(
          client.connect(transport),
          CONNECT_TIMEOUT_MS,
          `connect ${cfg.name}`,
        );
        const listed = await withTimeout(
          client.listTools(),
          CONNECT_TIMEOUT_MS,
          `listTools ${cfg.name}`,
        );
        const tools: McpToolDef[] = (listed.tools ?? []).map((t: any) => ({
          callName: sanitizeName(`${cfg.name}__${t.name}`),
          description: t.description ?? "",
          inputSchema: t.inputSchema ?? { type: "object", properties: {} },
          serverId: cfg.id,
          serverName: cfg.name,
          toolName: t.name,
        }));
        this.servers.set(cfg.id, {
          id: cfg.id,
          name: cfg.name,
          client,
          tools,
        });
        console.log(
          `[McpClientManager] Connected "${cfg.name}" (${tools.length} tools)`,
        );
      } catch (e: any) {
        console.warn(
          `[McpClientManager] Failed to connect "${cfg.name}":`,
          e?.message,
        );
      }
    }
  }

  hasTools(): boolean {
    for (const srv of this.servers.values()) if (srv.tools.length) return true;
    return false;
  }

  private allTools(): McpToolDef[] {
    return [...this.servers.values()].flatMap((s) => s.tools);
  }

  // ── Built-in Momor management tools (always available to the loop) ──────
  // Let the user install/manage skills + MCP servers from chat, e.g.
  // "install this skill https://github.com/owner/repo".

  private builtinDefs(): Array<{
    name: string;
    description: string;
    parameters: any;
  }> {
    return [
      {
        name: "momor_install_skill_from_url",
        description:
          "Install a skill into Momor from a GitHub repo or a raw SKILL.md/README URL. Fetches the file, parses name/description/instructions, and saves it as an enabled skill.",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "GitHub repo URL or raw SKILL.md/README URL",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "momor_create_skill",
        description:
          "Create a Momor skill directly from text (name, when-to-use description, and step-by-step instructions).",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            content: { type: "string" },
          },
          required: ["name", "content"],
        },
      },
      {
        name: "momor_add_mcp_server",
        description:
          "Add an MCP server to Momor so its tools become available. Provide stdio (command+args) or a remote url.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            transport: { type: "string", enum: ["stdio", "sse", "http"] },
            command: { type: "string" },
            args: { type: "array", items: { type: "string" } },
            env: { type: "object" },
            url: { type: "string" },
          },
          required: ["name", "transport"],
        },
      },
      {
        name: "momor_list_skills",
        description: "List the skills currently installed in Momor.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "momor_list_mcp_servers",
        description: "List the MCP servers currently configured in Momor.",
        parameters: { type: "object", properties: {} },
      },
    ];
  }

  private isBuiltin(name: string): boolean {
    return this.builtinDefs().some((d) => d.name === name);
  }

  private async callBuiltin(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const { DatabaseManager } = require("../../db/DatabaseManager");
    const dbm = DatabaseManager.getInstance();
    try {
      switch (name) {
        case "momor_install_skill_from_url": {
          const url = String(args.url ?? "").trim();
          if (!url) return "Error: url is required";
          const parsed = await fetchAndParseSkill(url);
          if (!parsed) return `Error: could not fetch a SKILL.md/README from ${url}`;
          const created = dbm.createSkill({
            name: parsed.name,
            description: parsed.description,
            content: parsed.content,
            enabled: true,
          });
          notifyWorkspace();
          return created
            ? `Installed skill "${parsed.name}". It is now enabled.`
            : "Error: failed to save the skill.";
        }
        case "momor_create_skill": {
          const created = dbm.createSkill({
            name: String(args.name ?? "skill"),
            description: String(args.description ?? ""),
            content: String(args.content ?? ""),
            enabled: true,
          });
          notifyWorkspace();
          return created ? `Created skill "${args.name}".` : "Error: failed to create skill.";
        }
        case "momor_add_mcp_server": {
          const created = dbm.createMcpServer({
            name: String(args.name ?? "server"),
            transport: (args.transport as any) ?? "stdio",
            command: (args.command as string) ?? null,
            args: Array.isArray(args.args) ? (args.args as string[]) : [],
            env: (args.env as Record<string, string>) ?? {},
            url: (args.url as string) ?? null,
            enabled: true,
          });
          notifyWorkspace();
          // Reconnect so the new server's tools become available immediately.
          this.ensureConnections().catch(() => {});
          return created
            ? `Added MCP server "${args.name}". Its tools will be available shortly.`
            : "Error: failed to add MCP server.";
        }
        case "momor_list_skills": {
          const skills = dbm.getSkills();
          return skills.length
            ? skills
                .map(
                  (s: any) =>
                    `- ${s.name}${s.enabled ? "" : " (disabled)"}: ${s.description || ""}`,
                )
                .join("\n")
            : "No skills installed.";
        }
        case "momor_list_mcp_servers": {
          const servers = dbm.getMcpServers();
          return servers.length
            ? servers
                .map(
                  (s: any) =>
                    `- ${s.name} [${s.transport}]${s.enabled ? "" : " (disabled)"}`,
                )
                .join("\n")
            : "No MCP servers configured.";
        }
        default:
          return `Error: unknown built-in tool "${name}"`;
      }
    } catch (e: any) {
      return `Error in ${name}: ${e?.message ?? "unknown error"}`;
    }
  }

  /** Built-in tools are always present so the user can install things from chat. */
  hasAnyTools(): boolean {
    return true;
  }

  /** OpenAI/Groq/DeepSeek/Ollama tool format (built-ins + MCP tools). */
  getOpenAiTools(): any[] {
    const builtin = this.builtinDefs().map((d) => ({
      type: "function",
      function: { name: d.name, description: d.description, parameters: d.parameters },
    }));
    const mcp = this.allTools().map((t) => ({
      type: "function",
      function: {
        name: t.callName,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
    return [...builtin, ...mcp];
  }

  /** Gemini functionDeclarations format (built-ins + MCP tools). */
  getGeminiTools(): any[] {
    const decls = [
      ...this.builtinDefs().map((d) => ({
        name: d.name,
        description: d.description,
        parameters: d.parameters,
      })),
      ...this.allTools().map((t) => ({
        name: t.callName,
        description: t.description,
        parameters: t.inputSchema,
      })),
    ];
    return decls.length ? [{ functionDeclarations: decls }] : [];
  }

  /** Execute a tool by its exposed callName; returns text content. */
  async callTool(callName: string, args: Record<string, unknown>): Promise<string> {
    if (this.isBuiltin(callName)) return this.callBuiltin(callName, args ?? {});
    const tool = this.allTools().find((t) => t.callName === callName);
    if (!tool) return `Error: unknown tool "${callName}"`;
    const srv = this.servers.get(tool.serverId);
    if (!srv) return `Error: MCP server for "${callName}" not connected`;
    try {
      const res: any = await withTimeout(
        srv.client.callTool({ name: tool.toolName, arguments: args ?? {} }),
        CONNECT_TIMEOUT_MS,
        `callTool ${callName}`,
      );
      const content = Array.isArray(res?.content) ? res.content : [];
      const text = content
        .map((c: any) =>
          c?.type === "text" ? c.text : c?.text ?? JSON.stringify(c),
        )
        .join("\n")
        .trim();
      return text || (res?.isError ? "Tool returned an error." : "(no output)");
    } catch (e: any) {
      return `Error calling ${callName}: ${e?.message ?? "unknown error"}`;
    }
  }
}
