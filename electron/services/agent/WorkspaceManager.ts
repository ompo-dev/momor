/**
 * WorkspaceManager — decides WHERE an agent CLI operates (its cwd) and enforces
 * that writes stay inside an allowed root.
 *
 * Strategies:
 *   fixed       — one shared folder (~/Momor/agent-workspace)
 *   per-meeting — ~/Momor/meetings/<safe-meeting-slug>/ (default; organizes
 *                 artifacts per meeting — matches "write a site about this call")
 *   custom      — a user-picked folder
 *
 * Safety: containsPath() rejects anything outside the workspace, and a denylist
 * blocks obviously sensitive roots even if a custom path points there.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { AgentCliSettings, AgentToolMode } from "./types";
import {
  extractLatestUserTurnText,
  extractPathTargetsFromText,
  pickExplicitWorkspaceDir,
} from "./LocalPathAccess";

export interface ResolvedAgentWorkspace {
  dir: string;
  source: "configured" | "referenced-path";
}

function sanitizeSlug(input: string): string {
  const cleaned = (input || "")
    .normalize("NFKD")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return cleaned || "session";
}

export class WorkspaceManager {
  private static instance: WorkspaceManager | null = null;

  static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  /** Root under which all auto-created workspaces live. */
  baseDir(): string {
    return path.join(os.homedir(), "Momor");
  }

  /** Directories an agent must never be rooted in, even via custom path. */
  private denylist(): string[] {
    const home = os.homedir();
    const roots =
      process.platform === "win32"
        ? [process.env.SystemRoot || "C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)"]
        : ["/", "/etc", "/usr", "/bin", "/sbin", "/System", "/Library"];
    return [home, ...roots].map((p) => path.resolve(p));
  }

  private isDenied(target: string): boolean {
    const resolved = path.resolve(target);
    return this.denylist().some((d) => resolved === d);
  }

  /**
   * Resolve the workspace directory for a run and ensure it exists.
   * Throws if a custom path lands on a denied root.
   */
  resolveWorkspace(
    settings: AgentCliSettings,
    meeting?: { id?: string; title?: string },
  ): string {
    const strategy = settings.workspaceStrategy ?? "per-meeting";
    let dir: string;

    if (strategy === "custom" && settings.customWorkspacePath) {
      dir = path.resolve(settings.customWorkspacePath);
      if (this.isDenied(dir)) {
        throw new Error(
          `Workspace path "${dir}" is a protected system directory. Pick a project folder.`,
        );
      }
    } else if (strategy === "fixed") {
      dir = path.join(this.baseDir(), "agent-workspace");
    } else {
      const slug = sanitizeSlug(meeting?.title || meeting?.id || "session");
      const unique = meeting?.id ? `${slug}-${meeting.id.slice(0, 8)}` : slug;
      dir = path.join(this.baseDir(), "meetings", unique);
    }

    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Prepare an explicitly shared project folder as the active workspace. */
  prepareExplicitWorkspace(targetDir: string): string {
    const dir = path.resolve(targetDir);
    if (dir === path.parse(dir).root || this.isDenied(dir)) {
      throw new Error(
        `Workspace path "${dir}" is a protected system directory. Pick a project folder.`,
      );
    }
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Resolve the active workspace for one turn, promoting an explicitly shared
   * local path to the workspace root when the latest user request points at a
   * single project folder.
   */
  resolveTurnWorkspace(
    settings: AgentCliSettings,
    meeting?: { id?: string; title?: string },
    promptText?: string,
    toolMode: AgentToolMode = "agentic",
  ): ResolvedAgentWorkspace {
    if (toolMode !== "plain") {
      const explicitDir = pickExplicitWorkspaceDir(
        extractPathTargetsFromText(extractLatestUserTurnText(promptText)),
      );
      if (explicitDir) {
        return {
          dir: this.prepareExplicitWorkspace(explicitDir),
          source: "referenced-path",
        };
      }
    }

    return {
      dir: this.resolveWorkspace(settings, meeting),
      source: "configured",
    };
  }

  /** True iff `target` is inside `workspace` (after resolving symlinks/..). */
  containsPath(workspace: string, target: string): boolean {
    const root = path.resolve(workspace);
    const resolved = path.resolve(workspace, target);
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  }

  /** Resolve a relative artifact path safely; throws if it escapes the workspace. */
  safeResolve(workspace: string, relativePath: string): string {
    if (!this.containsPath(workspace, relativePath)) {
      throw new Error(
        `Path "${relativePath}" escapes the agent workspace and was blocked.`,
      );
    }
    return path.resolve(workspace, relativePath);
  }
}
