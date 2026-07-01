/**
 * AgentAuditLog — append-only JSONL record of what agents did: tool calls,
 * file writes, commands, errors, and run lifecycle. One file per day under
 * <userData>/agent-audit/. Best-effort; never throws into the run path.
 */

import * as fs from "fs";
import * as path from "path";

export interface AuditEntry {
  ts: number;
  meetingId?: string;
  provider: string;
  kind:
    | "run_start"
    | "run_end"
    | "run_error"
    | "tool_call"
    | "tool_result"
    | "cancel";
  detail?: Record<string, unknown>;
}

export class AgentAuditLog {
  private static instance: AgentAuditLog | null = null;
  private dir: string | null = null;

  static getInstance(): AgentAuditLog {
    if (!AgentAuditLog.instance) AgentAuditLog.instance = new AgentAuditLog();
    return AgentAuditLog.instance;
  }

  /** Lazily resolved so we don't touch electron.app before it is ready. */
  private resolveDir(): string | null {
    if (this.dir) return this.dir;
    try {
      // Lazy require keeps this unit-testable without an Electron app.
      const { app } = require("electron");
      const base =
        (app?.getPath && app.getPath("userData")) ||
        process.env.momor_TEST_USER_DATA ||
        "";
      if (!base) return null;
      this.dir = path.join(base, "agent-audit");
      fs.mkdirSync(this.dir, { recursive: true });
      return this.dir;
    } catch {
      return null;
    }
  }

  record(entry: AuditEntry): void {
    try {
      const dir = this.resolveDir();
      if (!dir) return;
      const day = new Date(entry.ts).toISOString().slice(0, 10);
      const file = path.join(dir, `agent-${day}.jsonl`);
      fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
    } catch {
      // auditing must never break a run
    }
  }
}
