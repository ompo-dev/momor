import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import fs from "fs";
import { randomUUID } from "crypto";
import * as sqliteVec from "sqlite-vec";
import { OpenClaudeConfig } from "../openclaude/OpenClaudeConfig";

// Interfaces for our data objects
export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO string
  duration: string;
  summary: string;
  detailedSummary?: {
    overview?: string;
    actionItems: string[];
    keyPoints: string[];
    actionItemsTitle?: string;
    keyPointsTitle?: string;
    sections?: Array<{ title: string; bullets: string[] }>;
    schemaVersion?: number;
    actionItemsStructured?: Array<{
      id: string;
      text: string;
      owner?: string;
      deadline?: string;
      sourceTimestamp?: number;
    }>;
    followUpDraft?: string;
    coachingInsights?: Array<{
      id: string;
      type: string;
      title: string;
      detail: string;
      severity: "info" | "opportunity" | "warning";
      evidence?: string;
    }>;
  };
  transcript?: Array<{
    speaker: string;
    text: string;
    timestamp: number;
  }>;
  usage?: Array<{
    type: "assist" | "followup" | "chat" | "followup_questions";
    timestamp: number;
    question?: string;
    answer?: string;
    items?: string[];
  }>;
  calendarEventId?: string;
  source?: "manual" | "calendar";
  isProcessed?: boolean;
  folderId?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  folderId: string | null;
  title: string;
  icon: string | null; // emoji char OR an image data-URL/URL
  cover: string | null; // cover banner image data-URL/URL
  contentJson: string; // serialized BlockNote blocks
  contentText: string; // markdown/plaintext mirror for search
  sourceMeetingId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type McpTransport = "stdio" | "sse" | "http";
export type AbilitySource = "openclaude" | "momor";

export interface McpServer {
  id: string;
  name: string;
  transport: McpTransport;
  command: string | null; // stdio
  args: string[]; // stdio
  env: Record<string, string>; // stdio
  url: string | null; // sse / http
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  source: AbilitySource;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string; // instructions injected into the agent
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  source: AbilitySource;
}

/** Lightweight node used to build the workspace sidebar tree in one IPC call. */
export interface WorkspaceTree {
  folders: Folder[];
  notes: Array<{
    id: string;
    folderId: string | null;
    title: string;
    icon: string | null;
    sortOrder: number;
    updatedAt: string;
  }>;
  meetings: Array<{
    id: string;
    folderId: string | null;
    title: string;
    date: string;
    sortOrder: number;
  }>;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database.Database | null = null;
  private dbPath: string;
  private resolvedExtPath: string = "";

  private constructor() {
    const userDataPath = app.getPath("userData");
    this.dbPath = path.join(userDataPath, "momor.db");
    this.init();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private init() {
    try {
      console.log(`[DatabaseManager] Initializing database at ${this.dbPath}`);
      // Ensure directory exists (though userData usually does)
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[DatabaseManager] Created directory: ${dir}`);
      } else {
        console.log(`[DatabaseManager] Directory exists: ${dir}`);
        try {
          const files = fs.readdirSync(dir);
          console.log(`[DatabaseManager] Directory contents:`, files);
          const dbExists = fs.existsSync(this.dbPath);
          if (dbExists) {
            const stats = fs.statSync(this.dbPath);
            console.log(
              `[DatabaseManager] Found existing DB. Size: ${stats.size} bytes`,
            );
          } else {
            console.log(
              `[DatabaseManager] No existing DB found at ${this.dbPath}. Creating new one.`,
            );
          }
        } catch (e) {
          console.error("[DatabaseManager] Error checking directory/file:", e);
        }
      }

      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL");

      // Load sqlite-vec extension for native vector search
      try {
        // 1. sqlite-vec's getLoadablePath() returns a path inside app.asar
        //    (e.g. .../app.asar/node_modules/sqlite-vec-darwin-arm64/vec0.dylib)
        //    but dlopen() needs real files on disk, not files inside the asar archive.
        //    electron-builder's asarUnpack puts them in app.asar.unpacked instead.
        // 2. better-sqlite3's loadExtension() auto-appends the platform extension
        //    (.dylib/.so/.dll), so we strip it to avoid vec0.dylib.dylib.
        let extPath = sqliteVec.getLoadablePath();
        extPath = extPath.replace("app.asar", "app.asar.unpacked");
        extPath = extPath.replace(/\.(dylib|so|dll)$/, "");
        this.db.loadExtension(extPath);
        this.resolvedExtPath = extPath; // Store for worker thread access
        console.log(
          "[DatabaseManager] sqlite-vec extension loaded successfully",
        );
      } catch (extErr) {
        console.error(
          "[DatabaseManager] Failed to load sqlite-vec extension:",
          extErr,
        );
        console.warn(
          "[DatabaseManager] Vector search will fall back to JS cosine similarity",
        );
      }

      this.runMigrations();
      // Self-healing: guarantee the workspace schema exists on every boot,
      // independent of user_version. A DB can end up stamped at v15 without the
      // tables (interrupted/partial migration), and the version gate would then
      // never re-create them. CREATE TABLE IF NOT EXISTS is cheap and idempotent.
      this.ensureWorkspaceSchema();
      // Generalize the RAG chunk tables to a (source_type, source_id) model so
      // notes can be indexed alongside meetings. Idempotent + backfills.
      this.ensureRagSourceColumns();
      // Skills + MCP servers (configurable abilities surfaced in the sidebar).
      this.ensureSkillsMcpSchema();
    } catch (error) {
      console.error("[DatabaseManager] Failed to initialize database:", error);
      throw error;
    }
  }

  /**
   * Idempotently ensure the Notion-style workspace schema exists.
   * Runs unconditionally after migrations so a partially-migrated DB self-heals.
   */
  private ensureWorkspaceSchema(): void {
    if (!this.db) return;
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT,
            icon TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            folder_id TEXT,
            title TEXT NOT NULL DEFAULT 'Untitled',
            icon TEXT,
            cover TEXT,
            content_json TEXT NOT NULL DEFAULT '[]',
            content_text TEXT NOT NULL DEFAULT '',
            source_meeting_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
        CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
      `);

      // notes.cover — add only if missing (DBs created before cover existed).
      const noteCols = this.db
        .prepare("PRAGMA table_info(notes)")
        .all() as Array<{ name: string }>;
      if (!noteCols.some((c) => c.name === "cover")) {
        this.db.exec("ALTER TABLE notes ADD COLUMN cover TEXT");
      }

      // meetings.folder_id — add only if the column is missing.
      const cols = this.db
        .prepare("PRAGMA table_info(meetings)")
        .all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "folder_id")) {
        this.db.exec("ALTER TABLE meetings ADD COLUMN folder_id TEXT");
      }
      this.db.exec(
        "CREATE INDEX IF NOT EXISTS idx_meetings_folder ON meetings(folder_id);",
      );
      console.log("[DatabaseManager] Workspace schema ensured ✓");
    } catch (e) {
      console.error("[DatabaseManager] ensureWorkspaceSchema failed:", e);
    }
  }

  /**
   * Add (source_type, source_id, source_title) to the RAG chunk tables so the
   * pipeline can index notes alongside meetings. Existing rows are meetings, so
   * source_id is backfilled from meeting_id. Idempotent — runs every boot.
   */
  private ensureRagSourceColumns(): void {
    if (!this.db) return;
    const addCol = (table: string, col: string, type: string) => {
      try {
        const cols = this.db!.prepare(`PRAGMA table_info(${table})`).all() as Array<{
          name: string;
        }>;
        if (!cols.some((c) => c.name === col)) {
          this.db!.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        }
      } catch (e) {
        /* table may not exist yet on a brand-new DB before migrations created it */
      }
    };
    try {
      addCol("chunks", "source_type", "TEXT NOT NULL DEFAULT 'meeting'");
      addCol("chunks", "source_id", "TEXT");
      addCol("chunks", "source_title", "TEXT");
      addCol("chunk_summaries", "source_type", "TEXT NOT NULL DEFAULT 'meeting'");
      addCol("chunk_summaries", "source_id", "TEXT");
      addCol("embedding_queue", "source_type", "TEXT NOT NULL DEFAULT 'meeting'");
      addCol("embedding_queue", "source_id", "TEXT");

      // Backfill source_id from meeting_id for legacy meeting rows.
      this.db.exec(
        "UPDATE chunks SET source_id = meeting_id WHERE source_id IS NULL AND meeting_id IS NOT NULL",
      );
      this.db.exec(
        "UPDATE chunk_summaries SET source_id = meeting_id WHERE source_id IS NULL AND meeting_id IS NOT NULL",
      );
      this.db.exec(
        "UPDATE embedding_queue SET source_id = meeting_id WHERE source_id IS NULL AND meeting_id IS NOT NULL",
      );
      this.db.exec(
        "CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id)",
      );
      console.log("[DatabaseManager] RAG source columns ensured ✓");
    } catch (e) {
      console.error("[DatabaseManager] ensureRagSourceColumns failed:", e);
    }
  }

  // ── Folder helpers for RAG scope + context ────────────────────

  /** Human-readable folder path, e.g. "Projects / Lírio". Empty for root. */
  public getFolderPath(folderId: string | null): string {
    if (!this.db || !folderId) return "";
    const names: string[] = [];
    let current: string | null = folderId;
    const guard = new Set<string>();
    while (current) {
      if (guard.has(current)) break;
      guard.add(current);
      const row = this.db
        .prepare("SELECT name, parent_id FROM folders WHERE id = ?")
        .get(current) as { name: string; parent_id: string | null } | undefined;
      if (!row) break;
      names.unshift(row.name);
      current = row.parent_id;
    }
    return names.join(" / ");
  }

  /** All folder ids in the subtree rooted at folderId (inclusive). */
  public getFolderSubtreeIds(folderId: string): string[] {
    if (!this.db) return [];
    const result: string[] = [];
    const queue: string[] = [folderId];
    const guard = new Set<string>();
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (guard.has(id)) continue;
      guard.add(id);
      result.push(id);
      const kids = this.db
        .prepare("SELECT id FROM folders WHERE parent_id = ?")
        .all(id) as Array<{ id: string }>;
      for (const k of kids) queue.push(k.id);
    }
    return result;
  }

  /** Note + meeting source ids filed anywhere under a folder subtree. */
  public getSourceIdsInFolderSubtree(folderId: string): string[] {
    if (!this.db) return [];
    const folderIds = this.getFolderSubtreeIds(folderId);
    if (folderIds.length === 0) return [];
    const ph = folderIds.map(() => "?").join(",");
    try {
      const noteRows = this.db
        .prepare(`SELECT id FROM notes WHERE folder_id IN (${ph})`)
        .all(...folderIds) as Array<{ id: string }>;
      const meetingRows = this.db
        .prepare(`SELECT id FROM meetings WHERE folder_id IN (${ph})`)
        .all(...folderIds) as Array<{ id: string }>;
      return [...noteRows.map((r) => r.id), ...meetingRows.map((r) => r.id)];
    } catch (e) {
      console.error("[DatabaseManager] getSourceIdsInFolderSubtree failed:", e);
      return [];
    }
  }

  // ============================================
  // Skills & MCP servers (configurable abilities)
  // ============================================

  private ensureSkillsMcpSchema(): void {
    if (!this.db) return;
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            transport TEXT NOT NULL DEFAULT 'stdio',
            command TEXT,
            args TEXT NOT NULL DEFAULT '[]',
            env TEXT NOT NULL DEFAULT '{}',
            url TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("[DatabaseManager] Skills/MCP schema ensured ✓");
    } catch (e) {
      console.error("[DatabaseManager] ensureSkillsMcpSchema failed:", e);
    }
  }

  private mapMcpRow(row: any): McpServer {
    const parseJson = <T,>(s: string | null, fallback: T): T => {
      if (!s) return fallback;
      try {
        return JSON.parse(s) as T;
      } catch {
        return fallback;
      }
    };
    return {
      id: row.id,
      name: row.name,
      transport: (row.transport ?? "stdio") as McpTransport,
      command: row.command ?? null,
      args: parseJson<string[]>(row.args, []),
      env: parseJson<Record<string, string>>(row.env, {}),
      url: row.url ?? null,
      enabled: row.enabled !== 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      source: "momor",
    };
  }

  private getStoredMcpServers(): McpServer[] {
    if (!this.db) return [];
    const rows = this.db
      .prepare("SELECT * FROM mcp_servers ORDER BY created_at ASC")
      .all() as any[];
    return rows.map((r) => this.mapMcpRow(r));
  }

  public getMcpServers(): McpServer[] {
    try {
      const overlayRows = this.getStoredMcpServers();
      const openClaudeServers = OpenClaudeConfig.getInstance().listMcpServers();
      const overlayByName = new Map<string, McpServer>();
      for (const row of overlayRows) {
        const key = normalizeAbilityName(row.name);
        if (!overlayByName.has(key)) {
          overlayByName.set(key, row);
        }
      }

      const merged = openClaudeServers.map((server) => {
        const overlay = overlayByName.get(normalizeAbilityName(server.name));
        return {
          id: overlay?.id ?? syntheticAbilityId("mcp", server.name),
          name: server.name,
          transport: server.transport,
          command: server.command,
          args: server.args,
          env: server.env,
          url: server.url,
          enabled: overlay?.enabled ?? server.enabled,
          createdAt: overlay?.createdAt ?? server.createdAt,
          updatedAt: overlay?.updatedAt ?? server.updatedAt,
          source: "openclaude" as const,
        };
      });

      const openClaudeNames = new Set(
        openClaudeServers.map((server) => normalizeAbilityName(server.name)),
      );
      const legacyRows = overlayRows.filter(
        (row) => !openClaudeNames.has(normalizeAbilityName(row.name)),
      );

      return [...merged, ...legacyRows];
    } catch (e) {
      console.error("[DatabaseManager] getMcpServers failed:", e);
      return [];
    }
  }

  private saveMcpOverlay(server: McpServer): void {
    if (!this.db) return;
    const existing = this.db
      .prepare("SELECT id FROM mcp_servers WHERE id = ?")
      .get(server.id) as { id: string } | undefined;
    if (existing) {
      this.db
        .prepare(
          `UPDATE mcp_servers
             SET name = ?,
                 transport = ?,
                 command = ?,
                 args = ?,
                 env = ?,
                 url = ?,
                 enabled = ?,
                 updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(
          server.name,
          server.transport,
          server.command,
          JSON.stringify(server.args),
          JSON.stringify(server.env),
          server.url,
          server.enabled ? 1 : 0,
          server.id,
        );
      return;
    }

    this.db
      .prepare(
        `INSERT INTO mcp_servers (id, name, transport, command, args, env, url, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        server.id,
        server.name,
        server.transport,
        server.command,
        JSON.stringify(server.args),
        JSON.stringify(server.env),
        server.url,
        server.enabled ? 1 : 0,
      );
  }

  private syncMcpWithOpenClaude(
    previousName: string | null,
    next: Pick<
      McpServer,
      "name" | "transport" | "command" | "args" | "env" | "url"
    >,
  ): void {
    const config = OpenClaudeConfig.getInstance();
    const isValid =
      next.transport === "stdio"
        ? Boolean(next.command?.trim())
        : Boolean(next.url?.trim());

    if (previousName && normalizeAbilityName(previousName) !== normalizeAbilityName(next.name)) {
      config.removeMcpServer(previousName);
    }

    if (!isValid) {
      if (previousName && normalizeAbilityName(previousName) === normalizeAbilityName(next.name)) {
        config.removeMcpServer(previousName);
      }
      return;
    }

    if (next.transport === "stdio") {
      config.installMcpServer(next.name, {
        command: next.command!.trim(),
        args: next.args,
        env: next.env,
      });
      return;
    }

    config.installMcpServer(next.name, {
      type: next.transport,
      url: next.url!.trim(),
    });
  }

  public createMcpServer(input: {
    name: string;
    transport?: McpTransport;
    command?: string | null;
    args?: string[];
    env?: Record<string, string>;
    url?: string | null;
    enabled?: boolean;
  }): McpServer | null {
    if (!this.db) return null;
    try {
      const id = `mcp_${randomUUID()}`;
      const server: McpServer = {
        id,
        name: (input.name ?? "mcp").trim() || "mcp",
        transport: input.transport ?? "stdio",
        command: typeof input.command === "string" ? input.command.trim() || null : null,
        args: input.args ?? [],
        env: input.env ?? {},
        url: typeof input.url === "string" ? input.url.trim() || null : null,
        enabled: input.enabled !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: "momor",
      };

      this.syncMcpWithOpenClaude(null, server);
      this.saveMcpOverlay(server);
      return this.getMcpServers().find((item) => item.id === id) ?? server;
    } catch (e) {
      console.error("[DatabaseManager] createMcpServer failed:", e);
      return null;
    }
  }

  public updateMcpServer(
    id: string,
    updates: {
      name?: string;
      transport?: McpTransport;
      command?: string | null;
      args?: string[];
      env?: Record<string, string>;
      url?: string | null;
      enabled?: boolean;
    },
  ): boolean {
    try {
      const current = this.getMcpServers().find((item) => item.id === id);
      if (!current) return false;

      const next: McpServer = {
        ...current,
        name:
          updates.name !== undefined
            ? updates.name.trim() || current.name
            : current.name,
        transport: updates.transport ?? current.transport,
        command:
          updates.command !== undefined
            ? updates.command?.trim() || null
            : current.command,
        args: updates.args ?? current.args,
        env: updates.env ?? current.env,
        url:
          updates.url !== undefined ? updates.url?.trim() || null : current.url,
        enabled: updates.enabled ?? current.enabled,
        updatedAt: new Date().toISOString(),
      };

      this.syncMcpWithOpenClaude(
        current.source === "openclaude" ? current.name : null,
        next,
      );
      this.saveMcpOverlay({ ...next, source: "momor" });
      return true;
    } catch (e) {
      console.error("[DatabaseManager] updateMcpServer failed:", e);
      return false;
    }
  }

  public deleteMcpServer(id: string): boolean {
    try {
      const current =
        this.getMcpServers().find((item) => item.id === id) ??
        this.getStoredMcpServers().find((item) => item.id === id);
      const removedOpenClaude = current
        ? OpenClaudeConfig.getInstance().removeMcpServer(current.name)
        : false;
      const removedOverlay = this.db
        ? this.db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(id).changes > 0
        : false;
      return removedOpenClaude || removedOverlay;
    } catch (e) {
      console.error("[DatabaseManager] deleteMcpServer failed:", e);
      return false;
    }
  }

  /** Enabled MCP servers as a claude-style { name: configEntry } map. */
  public getEnabledMcpServersConfig(): Record<string, any> {
    const out: Record<string, any> = {};
    for (const s of this.getMcpServers()) {
      if (!s.enabled) continue;
      if (s.transport === "stdio") {
        if (!s.command) continue;
        out[s.name] = {
          command: s.command,
          args: s.args,
          ...(Object.keys(s.env).length ? { env: s.env } : {}),
        };
      } else {
        if (!s.url) continue;
        out[s.name] = { type: s.transport, url: s.url };
      }
    }
    return out;
  }

  // ── Skills ────────────────────────────────────────────────────

  private mapSkillRow(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      content: row.content ?? "",
      enabled: row.enabled !== 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      source: "momor",
    };
  }

  private getStoredSkills(): Skill[] {
    if (!this.db) return [];
    const rows = this.db
      .prepare("SELECT * FROM skills ORDER BY created_at ASC")
      .all() as any[];
    return rows.map((r) => this.mapSkillRow(r));
  }

  public getSkills(): Skill[] {
    try {
      const overlayRows = this.getStoredSkills();
      const openClaudeSkills = OpenClaudeConfig.getInstance().listSkills();
      const overlayByName = new Map<string, Skill>();
      for (const row of overlayRows) {
        const key = normalizeAbilityName(row.name);
        if (!overlayByName.has(key)) {
          overlayByName.set(key, row);
        }
      }

      const merged = openClaudeSkills.map((skill) => {
        const overlay = overlayByName.get(normalizeAbilityName(skill.name));
        return {
          id: overlay?.id ?? syntheticAbilityId("skill", skill.name),
          name: skill.name,
          description: skill.description,
          content: skill.content,
          enabled: overlay?.enabled ?? skill.enabled,
          createdAt: overlay?.createdAt ?? skill.createdAt,
          updatedAt: overlay?.updatedAt ?? skill.updatedAt,
          source: "openclaude" as const,
        };
      });

      const openClaudeNames = new Set(
        openClaudeSkills.map((skill) => normalizeAbilityName(skill.name)),
      );
      const legacyRows = overlayRows.filter(
        (row) => !openClaudeNames.has(normalizeAbilityName(row.name)),
      );

      return [...merged, ...legacyRows];
    } catch (e) {
      console.error("[DatabaseManager] getSkills failed:", e);
      return [];
    }
  }

  private saveSkillOverlay(skill: Skill): void {
    if (!this.db) return;
    const existing = this.db
      .prepare("SELECT id FROM skills WHERE id = ?")
      .get(skill.id) as { id: string } | undefined;
    if (existing) {
      this.db
        .prepare(
          `UPDATE skills
             SET name = ?,
                 description = ?,
                 content = ?,
                 enabled = ?,
                 updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(
          skill.name,
          skill.description,
          skill.content,
          skill.enabled ? 1 : 0,
          skill.id,
        );
      return;
    }

    this.db
      .prepare(
        `INSERT INTO skills (id, name, description, content, enabled)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        skill.id,
        skill.name,
        skill.description,
        skill.content,
        skill.enabled ? 1 : 0,
      );
  }

  private syncSkillWithOpenClaude(
    previousName: string | null,
    next: Pick<Skill, "name" | "description" | "content">,
  ): void {
    const config = OpenClaudeConfig.getInstance();
    if (previousName && normalizeAbilityName(previousName) !== normalizeAbilityName(next.name)) {
      config.removeSkill(previousName);
    }
    config.installSkill({
      name: next.name,
      description: next.description,
      content: next.content,
    });
  }

  public createSkill(input: {
    name: string;
    description?: string;
    content?: string;
    enabled?: boolean;
  }): Skill | null {
    try {
      const id = `skill_${randomUUID()}`;
      const skill: Skill = {
        id,
        name: (input.name ?? "skill").trim() || "skill",
        description: input.description ?? "",
        content: input.content ?? "",
        enabled: input.enabled !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: "momor",
      };

      this.syncSkillWithOpenClaude(null, skill);
      this.saveSkillOverlay(skill);
      return this.getSkills().find((item) => item.id === id) ?? skill;
    } catch (e) {
      console.error("[DatabaseManager] createSkill failed:", e);
      return null;
    }
  }

  public updateSkill(
    id: string,
    updates: {
      name?: string;
      description?: string;
      content?: string;
      enabled?: boolean;
    },
  ): boolean {
    try {
      const current = this.getSkills().find((item) => item.id === id);
      if (!current) return false;

      const next: Skill = {
        ...current,
        name:
          updates.name !== undefined
            ? updates.name.trim() || current.name
            : current.name,
        description: updates.description ?? current.description,
        content: updates.content ?? current.content,
        enabled: updates.enabled ?? current.enabled,
        updatedAt: new Date().toISOString(),
      };

      this.syncSkillWithOpenClaude(
        current.source === "openclaude" ? current.name : null,
        next,
      );
      this.saveSkillOverlay({ ...next, source: "momor" });
      return true;
    } catch (e) {
      console.error("[DatabaseManager] updateSkill failed:", e);
      return false;
    }
  }

  public deleteSkill(id: string): boolean {
    try {
      const current =
        this.getSkills().find((item) => item.id === id) ??
        this.getStoredSkills().find((item) => item.id === id);
      const removedOpenClaude = current
        ? OpenClaudeConfig.getInstance().removeSkill(current.name)
        : false;
      const removedOverlay = this.db
        ? this.db.prepare("DELETE FROM skills WHERE id = ?").run(id).changes > 0
        : false;
      return removedOpenClaude || removedOverlay;
    } catch (e) {
      console.error("[DatabaseManager] deleteSkill failed:", e);
      return false;
    }
  }

  /** Enabled skills, for injection into the agent system prompt. */
  public getEnabledSkills(): Skill[] {
    return this.getSkills().filter((s) => s.enabled && s.content.trim());
  }

  // ============================================
  // PRAGMA user_version Migration System
  // ============================================
  // Each version is applied exactly once, in order.
  // New migrations append a new `if (version < N)` block.
  // ============================================

  private runMigrations() {
    if (!this.db) return;

    const version =
      (this.db.pragma("user_version", { simple: true }) as number) || 0;
    console.log(`[DatabaseManager] Current schema version: ${version}`);

    // Version 0 → 1: Initial schema (all core tables)
    if (version < 1) {
      console.log(
        "[DatabaseManager] Applying migration v0 → v1: Initial schema",
      );
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS meetings (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    start_time INTEGER,
                    duration_ms INTEGER,
                    summary_json TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    calendar_event_id TEXT,
                    source TEXT,
                    is_processed INTEGER DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS transcripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT,
                    speaker TEXT,
                    content TEXT,
                    timestamp_ms INTEGER,
                    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ai_interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT,
                    type TEXT,
                    timestamp INTEGER,
                    user_query TEXT,
                    ai_response TEXT,
                    metadata_json TEXT,
                    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    speaker TEXT,
                    start_timestamp_ms INTEGER,
                    end_timestamp_ms INTEGER,
                    cleaned_text TEXT NOT NULL,
                    token_count INTEGER NOT NULL,
                    embedding BLOB,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS chunk_summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT NOT NULL UNIQUE,
                    summary_text TEXT NOT NULL,
                    embedding BLOB,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS embedding_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT NOT NULL,
                    chunk_id INTEGER,
                    status TEXT DEFAULT 'pending',
                    retry_count INTEGER DEFAULT 0,
                    error_message TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    processed_at TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_chunks_meeting ON chunks(meeting_id);

                CREATE TABLE IF NOT EXISTS user_profile (
                    id INTEGER PRIMARY KEY,
                    structured_json TEXT NOT NULL,
                    compact_persona TEXT NOT NULL,
                    intro_short TEXT,
                    intro_interview TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS resume_nodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT,
                    title TEXT,
                    organization TEXT,
                    start_date TEXT,
                    end_date TEXT,
                    duration_months INTEGER,
                    text_content TEXT,
                    tags TEXT,
                    embedding BLOB
                );
            `);
      this.db.pragma("user_version = 1");
    }

    // Version 1 → 2: Add columns for existing installs (safe for fresh installs too)
    if (version < 2) {
      console.log(
        "[DatabaseManager] Applying migration v1 → v2: Add meetings columns",
      );
      // For fresh installs these columns already exist from v1, so we guard with try/catch.
      // Unlike the old code, these are versioned and run exactly once.
      const columnsToAdd = [
        "ALTER TABLE meetings ADD COLUMN calendar_event_id TEXT",
        "ALTER TABLE meetings ADD COLUMN source TEXT",
        "ALTER TABLE meetings ADD COLUMN is_processed INTEGER DEFAULT 1",
      ];
      for (const sql of columnsToAdd) {
        try {
          this.db.exec(sql);
        } catch (e) {
          /* Column already exists from v1 CREATE */
        }
      }
      this.db.pragma("user_version = 2");
    }

    // Version 2 → 3: sqlite-vec virtual tables for native vector search
    if (version < 3) {
      console.log(
        "[DatabaseManager] Applying migration v2 → v3: vec0 virtual tables",
      );
      try {
        // Create vec0 virtual table for chunk embeddings (dynamic dimension)
        this.db.exec(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
                        chunk_id INTEGER PRIMARY KEY,
                        embedding float
                    );
                `);

        // Create vec0 virtual table for summary embeddings (dynamic dimension)
        this.db.exec(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS vec_summaries USING vec0(
                        summary_id INTEGER PRIMARY KEY,
                        embedding float
                    );
                `);

        // Migrate existing chunk embeddings from BLOB column to vec0 table
        this.migrateExistingEmbeddings();

        console.log(
          "[DatabaseManager] vec0 virtual tables created successfully",
        );
      } catch (e) {
        console.error(
          "[DatabaseManager] vec0 migration failed (sqlite-vec may not be loaded):",
          e,
        );
        console.warn(
          "[DatabaseManager] VectorStore will fall back to JS cosine similarity",
        );
      }
      this.db.pragma("user_version = 3");
    }

    // Version 3 → 4: Drop strict 768-dim vec0 tables to allow flexible embedding dimensions
    if (version < 4) {
      console.log(
        "[DatabaseManager] Applying migration v3 → v4: Drop strict dimension vec0 tables",
      );
      try {
        this.db.exec("DROP TABLE IF EXISTS vec_chunks;");
        this.db.exec("DROP TABLE IF EXISTS vec_summaries;");

        this.db.exec(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
                        chunk_id INTEGER PRIMARY KEY,
                        embedding float
                    );
                `);

        this.db.exec(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS vec_summaries USING vec0(
                        summary_id INTEGER PRIMARY KEY,
                        embedding float
                    );
                `);

        this.migrateExistingEmbeddings();
        console.log(
          "[DatabaseManager] vec0 virtual tables recreated for flexible dimensions",
        );
      } catch (e) {
        console.error("[DatabaseManager] vec0 migration v4 failed:", e);
      }
      this.db.pragma("user_version = 4");
    }

    // Version 4 → 5: Add embedding provider and dimensions columns
    if (version < 5) {
      console.log(
        "[DatabaseManager] Applying migration v4 → v5: Add embedding provider/dimensions columns",
      );
      const columnsToAdd = [
        "ALTER TABLE meetings ADD COLUMN embedding_provider TEXT",
        "ALTER TABLE meetings ADD COLUMN embedding_dimensions INTEGER",
      ];
      for (const sql of columnsToAdd) {
        try {
          this.db.exec(sql);
        } catch (e) {
          /* Column already exists */
        }
      }
      this.db.pragma("user_version = 5");
    }

    // Version 5 → 6: Add app_state table for KV storage (Ollama pull state, etc)
    if (version < 6) {
      console.log(
        "[DatabaseManager] Applying migration v5 → v6: Add app_state table",
      );
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS app_state (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `);
      this.db.pragma("user_version = 6");
    }

    // Version 6 → 7: Add indexes on transcripts and ai_interactions meeting_id
    // (Previously missing — causes O(N) full-table scans when fetching meeting details)
    if (version < 7) {
      console.log(
        "[DatabaseManager] Applying migration v6 → v7: Add meeting_id indexes",
      );
      try {
        this.db.exec(
          "CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON transcripts(meeting_id);",
        );
        this.db.exec(
          "CREATE INDEX IF NOT EXISTS idx_ai_interactions_meeting ON ai_interactions(meeting_id, timestamp);",
        );
        console.log(
          "[DatabaseManager] Meeting ID indexes created successfully",
        );
      } catch (e) {
        console.error(
          "[DatabaseManager] Failed to create indexes (non-fatal):",
          e,
        );
      }
      this.db.pragma("user_version = 7");
    }

    // Version 7 → 8: Provision per-dimension vec0 tables (NOTE: this v8 ran in two broken
    // iterations for some users — first with float[1536] single table, then with correct per-dim
    // tables. The v9 migration below corrects any v8 that used the old broken schema.)
    if (version < 8) {
      console.log(
        "[DatabaseManager] Applying migration v7 → v8: Provision per-dimension vec0 tables",
      );
      // Drop the legacy single-dim tables from v3/v4 if they exist and are unusable
      try {
        this.db.exec("DROP TABLE IF EXISTS vec_chunks;");
      } catch (_) {}
      try {
        this.db.exec("DROP TABLE IF EXISTS vec_summaries;");
      } catch (_) {}

      for (const dim of DatabaseManager.KNOWN_DIMS) {
        this.ensureVecTableForDim(dim);
      }
      console.log(
        "[DatabaseManager] v8 migration: per-dimension vec0 tables provisioned",
      );
      this.db.pragma("user_version = 8");
    }

    // Version 8 → 9: Ensure per-dimension tables exist.
    // Required for DBs already at v8 but with the old broken float[1536] single-table schema,
    // or with the first incorrect v8 migration that didn't provision KNOWN_DIMS tables.
    if (version < 9) {
      console.log(
        "[DatabaseManager] Applying migration v8 → v9: Ensure per-dimension vec0 tables exist",
      );
      // Drop old single-dim orphan tables if they exist (float[1536] schema)
      try {
        this.db.exec("DROP TABLE IF EXISTS vec_chunks;");
      } catch (_) {}
      try {
        this.db.exec("DROP TABLE IF EXISTS vec_summaries;");
      } catch (_) {}

      let allOk = true;
      for (const dim of DatabaseManager.KNOWN_DIMS) {
        this.ensureVecTableForDim(dim);
        // Verify the table actually exists after provisioning
        try {
          this.db
            .prepare(`SELECT count(*) FROM vec_chunks_${dim} LIMIT 1`)
            .get();
        } catch (e) {
          console.error(
            `[DatabaseManager] v9: vec_chunks_${dim} still missing after provisioning:`,
            e,
          );
          allOk = false;
        }
      }
      if (allOk) {
        console.log(
          "[DatabaseManager] v9 migration: all per-dimension vec0 tables verified ✓",
        );
      } else {
        console.warn(
          "[DatabaseManager] v9 migration: some tables missing — sqlite-vec extension may not be loaded",
        );
      }
      this.db.pragma("user_version = 9");
    }

    // Version 9 → 10: Add UNIQUE constraint on embedding_queue(meeting_id, chunk_id).
    // This enables INSERT OR IGNORE in EmbeddingPipeline.queueMeeting() to silently
    // skip duplicate rows when queueMeeting() is called more than once for the same meeting.
    // SQLite doesn't support ADD CONSTRAINT on existing tables, so we recreate the table
    // using the standard rename-create-copy-drop pattern.
    if (version < 10) {
      console.log(
        "[DatabaseManager] Applying migration v9 → v10: Add UNIQUE constraint to embedding_queue",
      );
      try {
        // Wrap all steps in an explicit better-sqlite3 transaction for atomicity.
        // If any step throws, the entire migration is rolled back cleanly —
        // preventing the dangerous half-renamed table state that a bare exec() chain would leave.
        const migrate = this.db.transaction(() => {
          // Step 1: Rename the existing table to a temp name
          this.db!.exec(
            "ALTER TABLE embedding_queue RENAME TO embedding_queue_old;",
          );

          // Step 2: Recreate with the UNIQUE(meeting_id, chunk_id) constraint
          this.db!.exec(`
                        CREATE TABLE embedding_queue (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            chunk_id INTEGER,
                            status TEXT DEFAULT 'pending',
                            retry_count INTEGER DEFAULT 0,
                            error_message TEXT,
                            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                            processed_at TEXT,
                            UNIQUE(meeting_id, chunk_id)
                        );
                    `);

          // Step 3: Copy rows; INSERT OR IGNORE silently drops any pre-existing duplicates
          this.db!.exec(`
                        INSERT OR IGNORE INTO embedding_queue
                            (id, meeting_id, chunk_id, status, retry_count, error_message, created_at, processed_at)
                        SELECT id, meeting_id, chunk_id, status, retry_count, error_message, created_at, processed_at
                        FROM embedding_queue_old;
                    `);

          // Step 4: Drop the backup
          this.db!.exec("DROP TABLE embedding_queue_old;");
        });
        migrate();
        console.log(
          "[DatabaseManager] v10 migration: embedding_queue UNIQUE constraint added ✓",
        );
      } catch (e) {
        console.error(
          "[DatabaseManager] v10 migration failed — table structure unchanged:",
          e,
        );
        // user_version still advances. We do NOT retry — a failed rename leaves
        // embedding_queue_old behind; retrying would cause "table already exists".
        // In the failure case, INSERT OR IGNORE in queueMeeting() will still work
        // for natural uniqueness (same meeting queued twice picks up existing rows),
        // just without DB-enforced deduplication.
      }
      this.db.pragma("user_version = 10");
    }

    // Version 10 → 11: Add modes, mode_reference_files, and mode_note_sections tables
    if (version < 11) {
      console.log(
        "[DatabaseManager] Applying migration v10 → v11: Add modes tables",
      );
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS modes (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    template_type TEXT NOT NULL DEFAULT 'general',
                    custom_context TEXT NOT NULL DEFAULT '',
                    is_active INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS mode_reference_files (
                    id TEXT PRIMARY KEY,
                    mode_id TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(mode_id) REFERENCES modes(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS mode_note_sections (
                    id TEXT PRIMARY KEY,
                    mode_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(mode_id) REFERENCES modes(id) ON DELETE CASCADE
                );
            `);
      // Seed a default "General" mode as active
      const defaultModeId = "mode_general_default";
      this.db
        .prepare(
          `
                INSERT OR IGNORE INTO modes (id, name, template_type, custom_context, is_active)
                VALUES (?, ?, ?, ?, 1)
            `,
        )
        .run(defaultModeId, "General", "general", "");
      this.db.pragma("user_version = 11");
    }

    // Version 11 → 12: Seed note sections for the default General mode if missing
    if (version < 12) {
      console.log(
        "[DatabaseManager] Applying migration v11 → v12: Seed default General mode note sections",
      );
      const defaultModeId = "mode_general_default";
      const modeExists = this.db
        .prepare("SELECT id FROM modes WHERE id = ?")
        .get(defaultModeId);
      const existing = modeExists
        ? this.db
            .prepare("SELECT id FROM mode_note_sections WHERE mode_id = ?")
            .get(defaultModeId)
        : null;
      if (modeExists && !existing) {
        const defaultSections = [
          {
            title: "Summary",
            description: "High-level summary of the conversation.",
          },
          {
            title: "Action items",
            description: "Tasks and follow-ups identified.",
          },
          { title: "Key points", description: "Important points discussed." },
        ];
        const insertSection = this.db.prepare(
          "INSERT OR IGNORE INTO mode_note_sections (id, mode_id, title, description, sort_order) VALUES (?, ?, ?, ?, ?)",
        );
        defaultSections.forEach((s, i) => {
          insertSection.run(
            `ns_general_${i}`,
            defaultModeId,
            s.title,
            s.description,
            i,
          );
        });
      }
      this.db.pragma("user_version = 12");
    }

    // Version 12 → 13: Backfill note sections for any mode instance that has none
    if (version < 13) {
      console.log(
        "[DatabaseManager] Applying migration v12 → v13: Backfill missing mode note sections",
      );
      const BACKFILL_SECTIONS: Record<
        string,
        Array<{ title: string; description: string }>
      > = {
        general: [
          {
            title: "Summary",
            description: "High-level summary of the conversation.",
          },
          {
            title: "Action items",
            description: "Tasks and follow-ups identified.",
          },
          { title: "Key points", description: "Important points discussed." },
        ],
        "looking-for-work": [
          {
            title: "Follow-up actions",
            description:
              "Next interview steps or additional materials I said I would send if applicable.",
          },
          {
            title: "Overview",
            description:
              "Overview of the interview, the company, and general structure.",
          },
          {
            title: "Questions and responses",
            description:
              "All questions asked to me during the interview and answers that gave.",
          },
          {
            title: "Areas to improve",
            description: "What I could have done better during the interview.",
          },
          {
            title: "Role details",
            description:
              "Anything discussed about the position, salary expectations, etc.",
          },
        ],
        sales: [
          {
            title: "Action Items",
            description:
              "All action items that were said I would do after the meeting.",
          },
          {
            title: "Outcome",
            description:
              "Did I close the sale and what was the outcome of the conversation.",
          },
          {
            title: "Prospect background",
            description: "Background and context on who I was selling to.",
          },
          {
            title: "Discovery",
            description: "What the prospect said during discovery.",
          },
          {
            title: "Product",
            description:
              "How I pitched the product and the prospect's reaction.",
          },
          {
            title: "Objections",
            description: "Objections from the prospect if there were any.",
          },
        ],
        recruiting: [
          {
            title: "Action Items",
            description:
              "All action items that I have to do after the meeting.",
          },
          {
            title: "Experience and skills",
            description:
              "Candidate's previous work experience and skills discussed.",
          },
          {
            title: "Quality of responses",
            description:
              "If there were questions asked, how well and how accurately the candidate answered each question.",
          },
          {
            title: "Interest in company",
            description:
              "What the candidate said about their interest in the company.",
          },
          {
            title: "Role expectations",
            description:
              "Anything discussed about the position, salary expectations, etc.",
          },
        ],
        "team-meet": [
          {
            title: "Action Items",
            description:
              "All action items that were said I would do after the meeting.",
          },
          {
            title: "Announcements",
            description: "Any team-wide announcements from the meeting.",
          },
          {
            title: "Team updates",
            description:
              "Each team member's progress, accomplishments, and current focus.",
          },
          {
            title: "Challenges or blockers",
            description:
              "Any issues or obstacles raised that may affect progress.",
          },
          {
            title: "Decisions made",
            description:
              "Key decisions or agreements reached during the meeting.",
          },
        ],
        lecture: [
          {
            title: "Follow-up work",
            description:
              "Follow-up reading, assignments, or tasks to complete.",
          },
          {
            title: "Topic",
            description: "Main subject or theme of the lecture.",
          },
          {
            title: "Key concepts",
            description: "Core ideas or frameworks covered.",
          },
          {
            title: "Content",
            description:
              "All content from the lecture with incredibly detailed bullet notes.",
          },
        ],
        "technical-interview": [
          {
            title: "Problems covered",
            description:
              "Each problem asked, the approach used, and the outcome.",
          },
          {
            title: "Concepts tested",
            description:
              "Key algorithms, data structures, or system design concepts that came up.",
          },
          {
            title: "What went well",
            description: "Approaches or explanations that landed well.",
          },
          {
            title: "Areas to study",
            description:
              "Topics or gaps identified that need more preparation.",
          },
          {
            title: "Action items",
            description:
              "Follow-up steps — e.g. send code, study specific topics, await next round.",
          },
        ],
      };

      const allModes = this.db
        .prepare("SELECT id, template_type FROM modes")
        .all() as Array<{ id: string; template_type: string }>;
      const insertSection = this.db.prepare(
        "INSERT OR IGNORE INTO mode_note_sections (id, mode_id, title, description, sort_order) VALUES (?, ?, ?, ?, ?)",
      );
      for (const mode of allModes) {
        const hasSection = this.db
          .prepare(
            "SELECT id FROM mode_note_sections WHERE mode_id = ? LIMIT 1",
          )
          .get(mode.id);
        if (!hasSection) {
          const sections = BACKFILL_SECTIONS[mode.template_type] ?? [];
          sections.forEach((s, i) => {
            insertSection.run(
              `ns_bf_${mode.id}_${i}`,
              mode.id,
              s.title,
              s.description,
              i,
            );
          });
          if (sections.length > 0) {
            console.log(
              `[DatabaseManager] Backfilled ${sections.length} sections for mode "${mode.id}" (${mode.template_type})`,
            );
          }
        }
      }
      this.db.pragma("user_version = 13");
    }

    // Version 13 → 14: Add profile_custom_notes table
    if (version < 14) {
      console.log(
        "[DatabaseManager] Applying migration v13 → v14: Add profile_custom_notes table",
      );
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS profile_custom_notes (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    content TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                INSERT OR IGNORE INTO profile_custom_notes (id, content) VALUES (1, '');
            `);
      this.db.pragma("user_version = 14");
    }

    // Version 14 → 15: Notion-style workspace — folders (nested) + standalone notes,
    // and a folder_id column on meetings so meetings can be filed into folders too.
    if (version < 15) {
      console.log(
        "[DatabaseManager] Applying migration v14 → v15: Add folders + notes (workspace)",
      );
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS folders (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    parent_id TEXT,
                    icon TEXT,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    folder_id TEXT,
                    title TEXT NOT NULL DEFAULT 'Untitled',
                    icon TEXT,
                    content_json TEXT NOT NULL DEFAULT '[]',
                    content_text TEXT NOT NULL DEFAULT '',
                    source_meeting_id TEXT,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
                CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
            `);
      // meetings.folder_id — guarded, since a fresh install may add it differently later.
      try {
        this.db.exec("ALTER TABLE meetings ADD COLUMN folder_id TEXT");
      } catch (e) {
        /* Column already exists */
      }
      try {
        this.db.exec(
          "CREATE INDEX IF NOT EXISTS idx_meetings_folder ON meetings(folder_id);",
        );
      } catch (e) {
        /* ignore */
      }
      this.db.pragma("user_version = 15");
    }

    console.log("[DatabaseManager] Migrations completed.");
  }

  // ============================================
  // Profile Custom Notes
  // ============================================

  public getCustomNotes(): string {
    if (!this.db) return "";
    try {
      const row = this.db
        .prepare("SELECT content FROM profile_custom_notes WHERE id = 1")
        .get() as { content: string } | undefined;
      return row?.content ?? "";
    } catch (e) {
      console.error("[DatabaseManager] getCustomNotes failed:", e);
      return "";
    }
  }

  public saveCustomNotes(content: string): void {
    if (!this.db) return;
    try {
      this.db
        .prepare(
          "INSERT INTO profile_custom_notes (id, content, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at",
        )
        .run(content);
    } catch (e) {
      console.error("[DatabaseManager] saveCustomNotes failed:", e);
    }
  }

  // ============================================
  // Modes CRUD
  // ============================================

  public getModes(): any[] {
    if (!this.db) return [];
    try {
      return this.db
        .prepare("SELECT * FROM modes ORDER BY created_at ASC")
        .all();
    } catch (e) {
      console.error("[DatabaseManager] getModes failed:", e);
      return [];
    }
  }

  public getActiveMode(): any | null {
    if (!this.db) return null;
    try {
      return (
        this.db
          .prepare("SELECT * FROM modes WHERE is_active = 1 LIMIT 1")
          .get() ?? null
      );
    } catch (e) {
      console.error("[DatabaseManager] getActiveMode failed:", e);
      return null;
    }
  }

  public createMode(mode: {
    id: string;
    name: string;
    templateType: string;
    customContext: string;
  }): void {
    if (!this.db) return;
    try {
      this.db
        .prepare(
          `
                INSERT INTO modes (id, name, template_type, custom_context, is_active)
                VALUES (?, ?, ?, ?, 0)
            `,
        )
        .run(mode.id, mode.name, mode.templateType, mode.customContext);
    } catch (e) {
      console.error("[DatabaseManager] createMode failed:", e);
    }
  }

  public updateMode(
    id: string,
    updates: { name?: string; templateType?: string; customContext?: string },
  ): void {
    if (!this.db) return;
    try {
      if (updates.name !== undefined) {
        this.db
          .prepare("UPDATE modes SET name = ? WHERE id = ?")
          .run(updates.name, id);
      }
      if (updates.templateType !== undefined) {
        this.db
          .prepare("UPDATE modes SET template_type = ? WHERE id = ?")
          .run(updates.templateType, id);
      }
      if (updates.customContext !== undefined) {
        this.db
          .prepare("UPDATE modes SET custom_context = ? WHERE id = ?")
          .run(updates.customContext, id);
      }
    } catch (e) {
      console.error("[DatabaseManager] updateMode failed:", e);
    }
  }

  public deleteMode(id: string): void {
    if (!this.db) return;
    try {
      this.db.prepare("DELETE FROM modes WHERE id = ?").run(id);
    } catch (e) {
      console.error("[DatabaseManager] deleteMode failed:", e);
    }
  }

  public setActiveMode(id: string | null): void {
    if (!this.db) return;
    try {
      const txn = this.db.transaction(() => {
        this.db!.prepare("UPDATE modes SET is_active = 0").run();
        if (id) {
          const result = this.db!.prepare(
            "UPDATE modes SET is_active = 1 WHERE id = ?",
          ).run(id);
          if (result.changes === 0) {
            console.warn(
              `[DatabaseManager] setActiveMode: no mode found with id "${id}" — active mode cleared`,
            );
          }
        }
      });
      txn();
    } catch (e) {
      console.error("[DatabaseManager] setActiveMode failed:", e);
    }
  }

  public getReferenceFiles(modeId: string): any[] {
    if (!this.db) return [];
    try {
      return this.db
        .prepare(
          "SELECT * FROM mode_reference_files WHERE mode_id = ? ORDER BY created_at ASC",
        )
        .all(modeId);
    } catch (e) {
      console.error("[DatabaseManager] getReferenceFiles failed:", e);
      return [];
    }
  }

  public addReferenceFile(file: {
    id: string;
    modeId: string;
    fileName: string;
    content: string;
  }): void {
    if (!this.db) throw new Error("Database not initialized");
    try {
      this.db
        .prepare(
          `
                INSERT INTO mode_reference_files (id, mode_id, file_name, content)
                VALUES (?, ?, ?, ?)
            `,
        )
        .run(file.id, file.modeId, file.fileName, file.content);
    } catch (e) {
      console.error("[DatabaseManager] addReferenceFile failed:", e);
      throw e;
    }
  }

  public deleteReferenceFile(id: string): void {
    if (!this.db) return;
    try {
      this.db.prepare("DELETE FROM mode_reference_files WHERE id = ?").run(id);
    } catch (e) {
      console.error("[DatabaseManager] deleteReferenceFile failed:", e);
    }
  }

  // ── Note Sections ─────────────────────────────────────────────

  public getNoteSections(modeId: string): any[] {
    if (!this.db) return [];
    try {
      return this.db
        .prepare(
          "SELECT * FROM mode_note_sections WHERE mode_id = ? ORDER BY sort_order ASC, created_at ASC",
        )
        .all(modeId);
    } catch (e) {
      console.error("[DatabaseManager] getNoteSections failed:", e);
      return [];
    }
  }

  public addNoteSection(section: {
    id: string;
    modeId: string;
    title: string;
    description: string;
    sortOrder: number;
  }): void {
    if (!this.db) return;
    try {
      this.db
        .prepare(
          `
                INSERT INTO mode_note_sections (id, mode_id, title, description, sort_order)
                VALUES (?, ?, ?, ?, ?)
            `,
        )
        .run(
          section.id,
          section.modeId,
          section.title,
          section.description,
          section.sortOrder,
        );
    } catch (e) {
      console.error("[DatabaseManager] addNoteSection failed:", e);
    }
  }

  public updateNoteSection(
    id: string,
    updates: { title?: string; description?: string; sortOrder?: number },
  ): void {
    if (!this.db) return;
    try {
      if (updates.title !== undefined) {
        this.db
          .prepare("UPDATE mode_note_sections SET title = ? WHERE id = ?")
          .run(updates.title, id);
      }
      if (updates.description !== undefined) {
        this.db
          .prepare("UPDATE mode_note_sections SET description = ? WHERE id = ?")
          .run(updates.description, id);
      }
      if (updates.sortOrder !== undefined) {
        this.db
          .prepare("UPDATE mode_note_sections SET sort_order = ? WHERE id = ?")
          .run(updates.sortOrder, id);
      }
    } catch (e) {
      console.error("[DatabaseManager] updateNoteSection failed:", e);
    }
  }

  public deleteNoteSection(id: string): void {
    if (!this.db) return;
    try {
      this.db.prepare("DELETE FROM mode_note_sections WHERE id = ?").run(id);
    } catch (e) {
      console.error("[DatabaseManager] deleteNoteSection failed:", e);
    }
  }

  public deleteAllNoteSections(modeId: string): void {
    if (!this.db) return;
    try {
      this.db
        .prepare("DELETE FROM mode_note_sections WHERE mode_id = ?")
        .run(modeId);
    } catch (e) {
      console.error("[DatabaseManager] deleteAllNoteSections failed:", e);
    }
  }

  // ============================================
  // System KV Store (app_state)
  // ============================================

  public getAppState(key: string): string | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare("SELECT value FROM app_state WHERE key = ?");
      const row = stmt.get(key) as { value: string } | undefined;
      return row ? row.value : null;
    } catch (error) {
      console.error(
        `[DatabaseManager] Failed to get app_state for key: ${key}`,
        error,
      );
      return null;
    }
  }

  public setAppState(key: string, value: string): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(
        "INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)",
      );
      stmt.run(key, value);
    } catch (error) {
      console.error(
        `[DatabaseManager] Failed to set app_state for key: ${key}`,
        error,
      );
    }
  }

  public deleteAppState(key: string): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare("DELETE FROM app_state WHERE key = ?");
      stmt.run(key);
    } catch (error) {
      console.error(
        `[DatabaseManager] Failed to delete app_state for key: ${key}`,
        error,
      );
    }
  }

  /**
   * One-time migration: Copy existing BLOB embeddings into vec0 virtual tables.
   */
  private migrateExistingEmbeddings(): void {
    if (!this.db) return;

    // Migrate chunk embeddings
    try {
      const chunkRows = this.db
        .prepare("SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL")
        .all() as any[];

      if (chunkRows.length > 0) {
        const insert = this.db.prepare(
          "INSERT OR IGNORE INTO vec_chunks(chunk_id, embedding) VALUES (?, ?)",
        );
        const migrateAll = this.db.transaction(() => {
          for (const row of chunkRows) {
            try {
              insert.run(row.id, row.embedding);
            } catch (err) {
              // On mismatch (e.g. mixed 768 and 3072 dims), nullify to re-embed later
              this.db
                .prepare("UPDATE chunks SET embedding = NULL WHERE id = ?")
                .run(row.id);
            }
          }
        });
        migrateAll();
        console.log(
          `[DatabaseManager] Migrated ${chunkRows.length} chunk embeddings to vec_chunks`,
        );
      }
    } catch (e) {
      console.error("[DatabaseManager] Failed to migrate chunk embeddings:", e);
    }

    // Migrate summary embeddings
    try {
      const summaryRows = this.db
        .prepare(
          "SELECT id, embedding FROM chunk_summaries WHERE embedding IS NOT NULL",
        )
        .all() as any[];

      if (summaryRows.length > 0) {
        const insert = this.db.prepare(
          "INSERT OR IGNORE INTO vec_summaries(summary_id, embedding) VALUES (?, ?)",
        );
        const migrateAll = this.db.transaction(() => {
          for (const row of summaryRows) {
            try {
              insert.run(row.id, row.embedding);
            } catch (err) {
              this.db
                .prepare(
                  "UPDATE chunk_summaries SET embedding = NULL WHERE id = ?",
                )
                .run(row.id);
            }
          }
        });
        migrateAll();
        console.log(
          `[DatabaseManager] Migrated ${summaryRows.length} summary embeddings to vec_summaries`,
        );
      }
    } catch (e) {
      console.error(
        "[DatabaseManager] Failed to migrate summary embeddings:",
        e,
      );
    }
  }

  /**
   * Known embedding dimension tiers.
   * Used by the v8 migration, delete operations, and table provisioning.
   * When a new provider dimension is encountered at runtime, ensureVecTableForDim() handles it.
   */
  public static readonly KNOWN_DIMS: readonly number[] = [768, 1536, 3072];

  /** Cache: dimensions for which vec0 tables have already been verified/created this session. */
  private ensuredDims = new Set<number>();

  /**
   * Lazily create a per-dimension vec0 table pair if not already present.
   * Called by v8 migration and at runtime when a new embedding dimension is first seen.
   * Uses an in-memory cache to avoid redundant CREATE TABLE IF NOT EXISTS on every insert.
   */
  public ensureVecTableForDim(dim: number): void {
    if (this.ensuredDims.has(dim)) return; // Already verified this session
    if (!this.db) return;
    // Guard against SQL injection: dim must be a positive integer
    if (!Number.isInteger(dim) || dim <= 0 || dim > 100_000) {
      console.error(
        `[DatabaseManager] Invalid dimension for vec0 table: ${dim}`,
      );
      return;
    }
    try {
      this.db.exec(`
                CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks_${dim} USING vec0(
                    chunk_id INTEGER PRIMARY KEY,
                    embedding float[${dim}]
                );
            `);
      this.db.exec(`
                CREATE VIRTUAL TABLE IF NOT EXISTS vec_summaries_${dim} USING vec0(
                    summary_id INTEGER PRIMARY KEY,
                    embedding float[${dim}]
                );
            `);
      this.ensuredDims.add(dim);
      console.log(`[DatabaseManager] Ensured vec0 tables for dim=${dim}`);
    } catch (e) {
      console.error(
        `[DatabaseManager] Failed to create vec0 tables for dim=${dim}:`,
        e,
      );
    }
  }

  /**
   * Check if sqlite-vec is available (any per-dimension vec0 table must exist)
   */
  public hasVecExtension(): boolean {
    if (!this.db) return false;
    try {
      // Check the most common dimension (Ollama 768); any may suffice
      this.db.prepare("SELECT count(*) FROM vec_chunks_768 LIMIT 1").get();
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Expose the raw database instance for external managers (e.g. ProfileDatabaseManager).
   */
  public getDb(): Database.Database | null {
    return this.db;
  }

  /** Path to the SQLite database file on disk. Used by worker threads. */
  public getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Resolved sqlite-vec extension path (without platform file suffix).
   * Used by worker threads that open their own DB connection.
   */
  public getExtPath(): string {
    return this.resolvedExtPath;
  }

  public saveMeeting(
    meeting: Meeting,
    startTimeMs: number,
    durationMs: number,
  ) {
    if (!this.db) {
      console.error("[DatabaseManager] DB not initialized");
      return;
    }

    const insertMeeting = this.db.prepare(`
            INSERT OR REPLACE INTO meetings (id, title, start_time, duration_ms, summary_json, created_at, calendar_event_id, source, is_processed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    const insertTranscript = this.db.prepare(`
            INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms)
            VALUES (?, ?, ?, ?)
        `);

    const insertInteraction = this.db.prepare(`
            INSERT INTO ai_interactions (meeting_id, type, timestamp, user_query, ai_response, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

    const summaryJson = JSON.stringify({
      legacySummary: meeting.summary,
      detailedSummary: meeting.detailedSummary,
    });

    const runTransaction = this.db.transaction(() => {
      // 1. Insert Meeting
      insertMeeting.run(
        meeting.id,
        meeting.title,
        startTimeMs,
        durationMs,
        summaryJson,
        meeting.date, // Using the ISO string as created_at for sorting simply
        meeting.calendarEventId || null,
        meeting.source || "manual",
        meeting.isProcessed ? 1 : 0,
      );

      // 2. Insert Transcript
      if (meeting.transcript) {
        for (const segment of meeting.transcript) {
          insertTranscript.run(
            meeting.id,
            segment.speaker,
            segment.text,
            segment.timestamp,
          );
        }
      }

      // 3. Insert Interactions
      if (meeting.usage) {
        for (const usage of meeting.usage) {
          let metadata = null;
          if (usage.items) {
            metadata = JSON.stringify(usage.items);
          } else if (usage.type === "followup_questions" && usage.answer) {
            // Sometimes answer is the array for questions, or we store it in metadata
            // In intelligence manager we pushed: { type: 'followup_questions', answer: fullQuestions }
            // Let's store that 'answer' (array) in metadata for this type
            if (Array.isArray(usage.answer)) {
              metadata = JSON.stringify(usage.answer);
            }
          }

          // Normalization
          const answerText = Array.isArray(usage.answer)
            ? null
            : usage.answer || null;
          const queryText = usage.question || null;

          insertInteraction.run(
            meeting.id,
            usage.type,
            usage.timestamp,
            queryText,
            answerText,
            metadata,
          );
        }
      }
    });

    try {
      runTransaction();
      console.log(`[DatabaseManager] Successfully saved meeting ${meeting.id}`);
    } catch (err) {
      console.error(
        `[DatabaseManager] Failed to save meeting ${meeting.id}`,
        err,
      );
      throw err;
    }
  }

  public updateMeetingTitle(id: string, title: string): boolean {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare(
        "UPDATE meetings SET title = ? WHERE id = ?",
      );
      const info = stmt.run(title, id);
      return info.changes > 0;
    } catch (error) {
      console.error(
        `[DatabaseManager] Failed to update title for meeting ${id}:`,
        error,
      );
      return false;
    }
  }

  public updateMeetingSummary(
    id: string,
    updates: {
      overview?: string;
      actionItems?: string[];
      keyPoints?: string[];
      actionItemsTitle?: string;
      keyPointsTitle?: string;
    },
  ): boolean {
    if (!this.db) return false;

    try {
      // 1. Get current summary_json
      const row = this.db
        .prepare("SELECT summary_json FROM meetings WHERE id = ?")
        .get(id) as any;
      if (!row) return false;

      const existingData = JSON.parse(row.summary_json || "{}");
      const currentDetailed = existingData.detailedSummary || {};

      // 2. Merge updates
      const newDetailed = {
        ...currentDetailed,
        ...updates,
      };

      // Should likely filter out undefined updates if spread doesn't handle them how we want,
      // but spread over undefined is fine. We want to overwrite if provided.
      // If updates.overview is empty string, it overwrites.
      // If updates.overview is undefined, we use ...updates trick:
      // Actually spread only includes own enumerable properties. If I pass { overview: "new" }, it works.

      // However, we need to be careful not to wipe legacySummary if it exists
      const newData = {
        ...existingData,
        detailedSummary: newDetailed,
      };

      const jsonStr = JSON.stringify(newData);

      // 3. Write back
      const stmt = this.db.prepare(
        "UPDATE meetings SET summary_json = ? WHERE id = ?",
      );
      const info = stmt.run(jsonStr, id);
      return info.changes > 0;
    } catch (error) {
      console.error(
        `[DatabaseManager] Failed to update summary for meeting ${id}:`,
        error,
      );
      return false;
    }
  }

  public getRecentMeetings(limit: number = 50): Meeting[] {
    if (!this.db) return [];

    const stmt = this.db.prepare(`
            SELECT * FROM meetings 
            ORDER BY created_at DESC 
            LIMIT ?
        `);

    const rows = stmt.all(limit) as any[];

    return rows.map((row) => {
      const summaryData = JSON.parse(row.summary_json || "{}");

      // Format duration string if needed, but we typically store ms
      // Let's recreate the 'duration' string "MM:SS" from duration_ms
      const minutes = Math.floor(row.duration_ms / 60000);
      const seconds = Math.floor((row.duration_ms % 60000) / 1000);
      const durationStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      return {
        id: row.id,
        title: row.title,
        date: row.created_at, // Use the stored ISO string
        duration: durationStr,
        summary: summaryData.legacySummary || "",
        detailedSummary: summaryData.detailedSummary,
        calendarEventId: row.calendar_event_id,
        source: row.source as any,
        // We don't load full transcript/usage for list view to keep it light
        transcript: [] as any[],
        usage: [] as any[],
      };
    });
  }

  public getMeetingDetails(id: string): Meeting | null {
    if (!this.db) return null;

    const meetingStmt = this.db.prepare("SELECT * FROM meetings WHERE id = ?");
    const meetingRow = meetingStmt.get(id) as any;

    if (!meetingRow) return null;

    // Get Transcript
    const transcriptStmt = this.db.prepare(
      "SELECT * FROM transcripts WHERE meeting_id = ? ORDER BY timestamp_ms ASC",
    );
    const transcriptRows = transcriptStmt.all(id) as any[];

    // Get Usage
    const usageStmt = this.db.prepare(
      "SELECT * FROM ai_interactions WHERE meeting_id = ? ORDER BY timestamp ASC",
    );
    const usageRows = usageStmt.all(id) as any[];

    // Reconstruct
    const summaryData = JSON.parse(meetingRow.summary_json || "{}");
    const minutes = Math.floor(meetingRow.duration_ms / 60000);
    const seconds = Math.floor((meetingRow.duration_ms % 60000) / 1000);
    const durationStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    const transcript = transcriptRows.map((row) => ({
      speaker: row.speaker,
      text: row.content,
      timestamp: row.timestamp_ms,
    }));

    const usage = usageRows.map((row) => {
      let items: string[] | undefined;
      let answer = row.ai_response;

      if (row.metadata_json) {
        try {
          const parsed = JSON.parse(row.metadata_json);
          if (Array.isArray(parsed)) {
            items = parsed;
            // Special case: for 'followup_questions', earlier we treated 'answer' as the array in memory
            // UI expects appropriate field. If type is 'followup_questions', usually answer is null and items has the questions.
          }
        } catch (e) {
          console.warn(
            "[DatabaseManager] Failed to parse metadata_json for interaction:",
            row?.id,
            e,
          );
        }
      }

      return {
        type: row.type,
        timestamp: row.timestamp,
        question: row.user_query,
        answer: answer,
        items: items,
      };
    });

    return {
      id: meetingRow.id,
      title: meetingRow.title,
      date: meetingRow.created_at,
      duration: durationStr,
      summary: summaryData.legacySummary || "",
      detailedSummary: summaryData.detailedSummary,
      calendarEventId: meetingRow.calendar_event_id,
      source: meetingRow.source,
      transcript: transcript,
      usage: usage,
    };
  }

  public deleteMeeting(id: string): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare("DELETE FROM meetings WHERE id = ?");
      const info = stmt.run(id);
      console.log(
        `[DatabaseManager] Deleted meeting ${id}. Changes: ${info.changes}`,
      );
      return info.changes > 0;
    } catch (error) {
      console.error(`[DatabaseManager] Failed to delete meeting ${id}:`, error);
      return false;
    }
  }

  public getUnprocessedMeetings(): Meeting[] {
    if (!this.db) return [];

    // is_processed = 0 means false
    const stmt = this.db.prepare(`
            SELECT * FROM meetings 
            WHERE is_processed = 0 
            ORDER BY created_at DESC
        `);

    const rows = stmt.all() as any[];

    return rows.map((row) => {
      // Reconstruct minimal meeting object for processing
      // We mainly need ID to fetch transcripts later
      const summaryData = JSON.parse(row.summary_json || "{}");
      const minutes = Math.floor(row.duration_ms / 60000);
      const seconds = Math.floor((row.duration_ms % 60000) / 1000);
      const durationStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      return {
        id: row.id,
        title: row.title,
        date: row.created_at,
        duration: durationStr,
        summary: summaryData.legacySummary || "",
        detailedSummary: summaryData.detailedSummary,
        calendarEventId: row.calendar_event_id,
        source: row.source,
        isProcessed: false,
        transcript: [] as any[], // Fetched separately via getMeetingDetails or manually if needed
        usage: [] as any[],
      };
    });
  }

  // ============================================
  // Workspace: Folders & Notes (Notion-style)
  // ============================================

  private mapFolderRow(row: any): Folder {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id ?? null,
      icon: row.icon ?? null,
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapNoteRow(row: any): Note {
    return {
      id: row.id,
      folderId: row.folder_id ?? null,
      title: row.title,
      icon: row.icon ?? null,
      cover: row.cover ?? null,
      contentJson: row.content_json ?? "[]",
      contentText: row.content_text ?? "",
      sourceMeetingId: row.source_meeting_id ?? null,
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Folders ───────────────────────────────────────────────────

  public getFolders(): Folder[] {
    if (!this.db) return [];
    try {
      const rows = this.db
        .prepare("SELECT * FROM folders ORDER BY sort_order ASC, created_at ASC")
        .all() as any[];
      return rows.map((r) => this.mapFolderRow(r));
    } catch (e) {
      console.error("[DatabaseManager] getFolders failed:", e);
      return [];
    }
  }

  public createFolder(input: {
    name: string;
    parentId?: string | null;
    icon?: string | null;
    sortOrder?: number;
  }): Folder | null {
    if (!this.db) return null;
    try {
      const id = `folder_${randomUUID()}`;
      this.db
        .prepare(
          `INSERT INTO folders (id, name, parent_id, icon, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.name,
          input.parentId ?? null,
          input.icon ?? null,
          input.sortOrder ?? 0,
        );
      const row = this.db
        .prepare("SELECT * FROM folders WHERE id = ?")
        .get(id) as any;
      return row ? this.mapFolderRow(row) : null;
    } catch (e) {
      console.error("[DatabaseManager] createFolder failed:", e);
      return null;
    }
  }

  public renameFolder(id: string, name: string, icon?: string | null): boolean {
    if (!this.db) return false;
    try {
      const info =
        icon === undefined
          ? this.db
              .prepare(
                "UPDATE folders SET name = ?, updated_at = datetime('now') WHERE id = ?",
              )
              .run(name, id)
          : this.db
              .prepare(
                "UPDATE folders SET name = ?, icon = ?, updated_at = datetime('now') WHERE id = ?",
              )
              .run(name, icon, id);
      return info.changes > 0;
    } catch (e) {
      console.error("[DatabaseManager] renameFolder failed:", e);
      return false;
    }
  }

  /** Detects whether `candidateParentId` is `folderId` itself or a descendant of it. */
  private isFolderDescendant(
    folderId: string,
    candidateParentId: string,
  ): boolean {
    if (!this.db) return false;
    let current: string | null = candidateParentId;
    const guard = new Set<string>();
    while (current) {
      if (current === folderId) return true;
      if (guard.has(current)) break; // cycle safety
      guard.add(current);
      const row = this.db
        .prepare("SELECT parent_id FROM folders WHERE id = ?")
        .get(current) as any;
      current = row?.parent_id ?? null;
    }
    return false;
  }

  public setFolderParent(
    id: string,
    parentId: string | null,
    sortOrder: number,
  ): boolean {
    if (!this.db) return false;
    // Block moving a folder into itself or one of its own descendants (would orphan a subtree).
    if (parentId && this.isFolderDescendant(id, parentId)) {
      console.warn(
        `[DatabaseManager] setFolderParent rejected: ${parentId} is inside ${id}`,
      );
      return false;
    }
    try {
      const info = this.db
        .prepare(
          "UPDATE folders SET parent_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .run(parentId, sortOrder, id);
      return info.changes > 0;
    } catch (e) {
      console.error("[DatabaseManager] setFolderParent failed:", e);
      return false;
    }
  }

  public deleteFolder(id: string): boolean {
    if (!this.db) return false;
    try {
      // Child folders cascade (FK ON DELETE CASCADE). Notes/meetings filed here
      // fall back to root (folder_id → NULL) instead of being deleted, so users
      // never lose content by removing an organizational folder.
      const run = this.db.transaction(() => {
        const childFolders = this.db!.prepare(
          "SELECT id FROM folders WHERE parent_id = ?",
        ).all(id) as Array<{ id: string }>;
        for (const child of childFolders) this.deleteFolder(child.id);
        this.db!.prepare("UPDATE notes SET folder_id = NULL WHERE folder_id = ?").run(id);
        this.db!.prepare("UPDATE meetings SET folder_id = NULL WHERE folder_id = ?").run(id);
        this.db!.prepare("DELETE FROM folders WHERE id = ?").run(id);
      });
      run();
      return true;
    } catch (e) {
      console.error("[DatabaseManager] deleteFolder failed:", e);
      return false;
    }
  }

  // ── Notes ─────────────────────────────────────────────────────

  public getNote(id: string): Note | null {
    if (!this.db) return null;
    try {
      const row = this.db
        .prepare("SELECT * FROM notes WHERE id = ?")
        .get(id) as any;
      return row ? this.mapNoteRow(row) : null;
    } catch (e) {
      console.error("[DatabaseManager] getNote failed:", e);
      return null;
    }
  }

  public createNote(input: {
    title?: string;
    folderId?: string | null;
    icon?: string | null;
    contentJson?: string;
    contentText?: string;
    sourceMeetingId?: string | null;
    sortOrder?: number;
  }): Note | null {
    if (!this.db) return null;
    try {
      const id = `note_${randomUUID()}`;
      this.db
        .prepare(
          `INSERT INTO notes (id, folder_id, title, icon, content_json, content_text, source_meeting_id, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.folderId ?? null,
          input.title ?? "Untitled",
          input.icon ?? null,
          input.contentJson ?? "[]",
          input.contentText ?? "",
          input.sourceMeetingId ?? null,
          input.sortOrder ?? 0,
        );
      return this.getNote(id);
    } catch (e) {
      console.error("[DatabaseManager] createNote failed:", e);
      return null;
    }
  }

  public updateNote(
    id: string,
    updates: {
      title?: string;
      icon?: string | null;
      cover?: string | null;
      contentJson?: string;
      contentText?: string;
    },
  ): boolean {
    if (!this.db) return false;
    try {
      const sets: string[] = [];
      const params: any[] = [];
      if (updates.title !== undefined) {
        sets.push("title = ?");
        params.push(updates.title);
      }
      if (updates.icon !== undefined) {
        sets.push("icon = ?");
        params.push(updates.icon);
      }
      if (updates.cover !== undefined) {
        sets.push("cover = ?");
        params.push(updates.cover);
      }
      if (updates.contentJson !== undefined) {
        sets.push("content_json = ?");
        params.push(updates.contentJson);
      }
      if (updates.contentText !== undefined) {
        sets.push("content_text = ?");
        params.push(updates.contentText);
      }
      if (sets.length === 0) return false;
      sets.push("updated_at = datetime('now')");
      params.push(id);
      const info = this.db
        .prepare(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`)
        .run(...params);
      return info.changes > 0;
    } catch (e) {
      console.error("[DatabaseManager] updateNote failed:", e);
      return false;
    }
  }

  public moveNote(
    id: string,
    folderId: string | null,
    sortOrder: number,
  ): boolean {
    if (!this.db) return false;
    try {
      const info = this.db
        .prepare(
          "UPDATE notes SET folder_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .run(folderId, sortOrder, id);
      return info.changes > 0;
    } catch (e) {
      console.error("[DatabaseManager] moveNote failed:", e);
      return false;
    }
  }

  public deleteNote(id: string): boolean {
    if (!this.db) return false;
    try {
      const info = this.db.prepare("DELETE FROM notes WHERE id = ?").run(id);
      return info.changes > 0;
    } catch (e) {
      console.error("[DatabaseManager] deleteNote failed:", e);
      return false;
    }
  }

  /** Lightweight literal search over note titles + plaintext mirror. */
  public searchNotes(query: string, limit: number = 20): Note[] {
    if (!this.db) return [];
    const q = query.trim();
    if (!q) return [];
    try {
      const like = `%${q}%`;
      const rows = this.db
        .prepare(
          `SELECT * FROM notes WHERE title LIKE ? OR content_text LIKE ?
           ORDER BY updated_at DESC LIMIT ?`,
        )
        .all(like, like, limit) as any[];
      return rows.map((r) => this.mapNoteRow(r));
    } catch (e) {
      console.error("[DatabaseManager] searchNotes failed:", e);
      return [];
    }
  }

  // ── Meeting filing ────────────────────────────────────────────

  public setMeetingFolder(id: string, folderId: string | null): boolean {
    if (!this.db) return false;
    try {
      const info = this.db
        .prepare("UPDATE meetings SET folder_id = ? WHERE id = ?")
        .run(folderId, id);
      return info.changes > 0;
    } catch (e) {
      console.error("[DatabaseManager] setMeetingFolder failed:", e);
      return false;
    }
  }

  // ── Unified tree ──────────────────────────────────────────────

  public getWorkspaceTree(): WorkspaceTree {
    if (!this.db) return { folders: [], notes: [], meetings: [] };
    try {
      const folders = this.getFolders();
      const noteRows = this.db
        .prepare(
          "SELECT id, folder_id, title, icon, sort_order, updated_at FROM notes ORDER BY sort_order ASC, updated_at DESC",
        )
        .all() as any[];
      const meetingRows = this.db
        .prepare(
          "SELECT id, folder_id, title, created_at FROM meetings ORDER BY created_at DESC",
        )
        .all() as any[];
      return {
        folders,
        notes: noteRows.map((r) => ({
          id: r.id,
          folderId: r.folder_id ?? null,
          title: r.title,
          icon: r.icon ?? null,
          sortOrder: r.sort_order ?? 0,
          updatedAt: r.updated_at,
        })),
        meetings: meetingRows.map((r) => ({
          id: r.id,
          folderId: r.folder_id ?? null,
          title: r.title,
          date: r.created_at,
          sortOrder: 0,
        })),
      };
    } catch (e) {
      console.error("[DatabaseManager] getWorkspaceTree failed:", e);
      return { folders: [], notes: [], meetings: [] };
    }
  }

  public clearAllData(): boolean {
    if (!this.db) return false;

    try {
      // Clear all tables atomically (order matters due to foreign keys,
      // but SQLite handles cascades). Using a transaction ensures we never
      // end up in a half-cleared state if one statement fails.
      this.db.transaction(() => {
        this.db!.exec("DELETE FROM embedding_queue");
        this.db!.exec("DELETE FROM chunk_summaries");
        this.db!.exec("DELETE FROM chunks");
        this.db!.exec("DELETE FROM ai_interactions");
        this.db!.exec("DELETE FROM transcripts");
        this.db!.exec("DELETE FROM meetings");
        // Workspace tables (guarded: pre-v15 DBs won't have them)
        try {
          this.db!.exec("DELETE FROM notes");
        } catch (_) {}
        try {
          this.db!.exec("DELETE FROM folders");
        } catch (_) {}
      })();

      console.log("[DatabaseManager] All data cleared from database.");
      return true;
    } catch (error) {
      console.error("[DatabaseManager] Failed to clear all data:", error);
      return false;
    }
  }

  public seedDemoMeeting() {
    if (!this.db) return;

    // Check if demo meeting already exists
    const existing = this.db
      .prepare("SELECT id FROM meetings WHERE id = ?")
      .get("demo-meeting");
    if (existing) {
      console.log(
        "[DatabaseManager] Demo meeting already exists, skipping seed.",
      );
      return;
    }

    // Do NOT flush all meetings. Preserving user data is critical.
    // If we really need to clean up old demo data, we should delete only that ID.
    // this.deleteMeeting('demo-meeting'); // Optional safety if we wanted to force update

    const demoId = "demo-meeting";

    // Set date to today 9:30 AM
    const today = new Date();
    today.setHours(9, 30, 0, 0);

    const durationMs = 300000; // 5 min

    const summaryMarkdown = `# Overview

Momor is a real-time AI meeting assistant designed to help you stay focused, informed, and fast-moving during calls. Get live insights while you speak, instant answers to questions, and structured notes after every meeting.

# Getting Started

### Start a Session
Click **Start Session** from the dashboard.
Join a scheduled meeting and start directly from the meeting notification.

### During a Meeting
- Use the **five quick action buttons** for real-time assistance
- Show or hide Momor at any time:
  - **Mac**: Cmd + B
  - **Windows**: Ctrl + B
- Move the widget anywhere on your screen by hovering over the top pill and dragging

# Main Features

## Five Quick Action Buttons
- **What to answer**: Instantly generates a context-aware response to the current topic.
- **Clarify**: Asks a targeted, senior-level clarifying question to establish constraints.
- **Recap**: Generates a comprehensive summary of the conversation so far.
- **Follow Up Question**: Suggests strategic questions you can ask to drive the conversation.
- **Answer**: Manually trigger a response or use voice input to ask specific questions.

## Meeting Insights (Launcher)
- **Smart Note Taking**: Automatically captures key points, action items, and structured summaries.
- **Summary**: A concise high-level brief of the entire meeting.
- **Transcript**: Full real-time speech-to-text transcript, available during and after the call.
- **Usage**: Track your interaction history and see how Momor assisted you.

## Live Insights
Click **Live Insights** during a call to view:
- Real-time questions and prompts
- Detected keywords and topics
- Context-aware suggestions based on the conversation
- Click any insight to get an instant response.

## AI Chat
- Type your question and press **Enter** or click **Submit**
- Enable **Smart Mode** for advanced reasoning and coding assistance

## Screenshots
- **Full Screen Screenshot**: Cmd + H
- **Selective Screenshot**: Cmd + Shift + H

# Making the Most of Momor

### Custom Context
Upload resumes, project briefs, sales scripts, or other documents to tailor responses to your workflow. (coming soon).

### Language Preferences
Go to **Settings → Language Preferences** to:
- Change input and output language
- Enable real-time translation during calls

### Undetectability
Unlock the **Undetectability** add-on to keep Momor invisible during screen sharing.

# Interface Basics

- **Dashboard**: Start meetings and view recent activity
- **Start Session**: Begin a new meeting instantly
- **Settings**: Configure API keys, language, and visibility
- **History**: Review past meetings, notes, and transcripts

# API Setup

1. Open **Settings**
2. Scroll to **Credentials**
3. Add your API keys:
   - **Gemini**
   - **Groq**
4. To enable real-time transcription, select the location of your **Google Cloud service account JSON file**.

If you don’t already have one, follow the steps below to create it.

# Creating a Google Speech-to-Text Service Account

## 1. Create or Select a Project
- Open **Google Cloud Console**
- Create a new project or select an existing one
- Ensure billing is enabled

## 2. Enable Speech-to-Text API
- Go to **APIs & Services → Library**
- Enable **Speech-to-Text API**

## 3. Create a Service Account
- Navigate to **IAM & Admin → Service Accounts**
- Click **Create Service Account**
- **Name**: momor-stt
- **Description**: optional

## 4. Assign Permissions
- Grant the following role: **Speech-to-Text User** (\`roles/speech.client\`)

## 5. Create a JSON Key
- Open the service account
- Go to **Keys → Add Key → Create new key**
- Select **JSON**
- Download the file

**Once downloaded, return to Settings → Credentials in Momor and select this file to complete setup.**

# Free Google Cloud Credit (New Users)

New Google Cloud accounts receive **$300 in free credits**, valid for 90 days.

To activate:
1. Visit [cloud.google.com](https://cloud.google.com)
2. Click **Get started for free**
3. Sign in with a Google account
4. Add billing details (card required)
5. Activate the free trial

The credit can be used for Speech-to-Text and is sufficient for extended testing and regular usage.

# Support

If you need help with setup or usage, contact us anytime at:
momor.contact@gmail.com`;

    const demoMeeting: Meeting = {
      id: demoId,
      title: "Momor Demo & Guide",
      date: today.toISOString(),
      duration: "5:00",
      summary:
        "Complete guide to using Momor - your real-time AI meeting assistant.",
      detailedSummary: {
        overview: summaryMarkdown,
        actionItems: [],
        keyPoints: [],
      },
      transcript: [
        {
          speaker: "interviewer",
          text: "Welcome to Momor! Let me show you how it works.",
          timestamp: 0,
        },
        {
          speaker: "user",
          text: "Thanks! I'm excited to try it out.",
          timestamp: 5000,
        },
        {
          speaker: "interviewer",
          text: "You have 5 quick action buttons. 'What to answer' listens to the conversation and suggests what you should say.",
          timestamp: 10000,
        },
        {
          speaker: "user",
          text: "That sounds helpful for interviews.",
          timestamp: 18000,
        },
        {
          speaker: "interviewer",
          text: "Check out the 'How to Use' section in the notes for API setup instructions.",
          timestamp: 20000,
        },
        {
          speaker: "interviewer",
          text: "'Clarify' asks a targeted question to get missing constraints. 'Recap' summarizes the entire conversation so far.",
          timestamp: 22000,
        },
        {
          speaker: "user",
          text: "What about the other buttons?",
          timestamp: 30000,
        },
        {
          speaker: "interviewer",
          text: "'Follow Up Questions' suggests questions you can ask. 'Answer' lets you speak a question and get an instant response.",
          timestamp: 35000,
        },
        {
          speaker: "user",
          text: "Can I take screenshots during calls?",
          timestamp: 45000,
        },
        {
          speaker: "interviewer",
          text: "Yes! Press Cmd+H for full screen or Cmd+Shift+H to select an area. The AI will analyze it and help you.",
          timestamp: 50000,
        },
        {
          speaker: "user",
          text: "How do I hide Momor during screen share?",
          timestamp: 60000,
        },
        {
          speaker: "interviewer",
          text: "Press Cmd+B to toggle visibility anytime. You can also enable undetectable mode in settings.",
          timestamp: 65000,
        },
        {
          speaker: "user",
          text: "This is amazing. What happens after the call?",
          timestamp: 75000,
        },
        {
          speaker: "interviewer",
          text: "You get detailed meeting notes with action items, key points, full transcript, and a log of all AI interactions.",
          timestamp: 80000,
        },
      ],
      usage: [
        {
          type: "assist",
          timestamp: 15000,
          question: "What features does Momor have?",
          answer:
            "Momor offers 5 quick action buttons, screenshot analysis, real-time transcription, and comprehensive meeting notes.",
        },
        {
          type: "followup",
          timestamp: 40000,
          question: "How do the action buttons work?",
          answer:
            "Each button serves a specific purpose: suggest answers, clarify questions, recap conversations, generate follow-up questions, or get instant voice-to-answer responses.",
        },
      ],
      isProcessed: true,
    };

    this.saveMeeting(demoMeeting, today.getTime(), durationMs);
    console.log("[DatabaseManager] Seeded demo meeting.");
  }
}

function normalizeAbilityName(name: string): string {
  return name.trim().toLowerCase();
}

function syntheticAbilityId(kind: "mcp" | "skill", name: string): string {
  const slug =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || kind;
  return `openclaude-${kind}:${slug}`;
}
