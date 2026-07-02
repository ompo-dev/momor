/**
 * OpenClaudeManager — single source of truth for locating (and, when missing,
 * installing) the `openclaude` CLI that backs every LLM turn in Momor.
 *
 * openclaude is distributed as `@gitlawb/openclaude` (bun/node CLI). At runtime
 * we drive its built entry `dist/cli.mjs` directly with `ELECTRON_RUN_AS_NODE=1`
 * (see ClaudeCodeAdapter). Resolution order:
 *   1. OPENCLAUDE_CLI_PATH env override (absolute path to cli.mjs or a binary)
 *   2. `<npm root -g>/@gitlawb/openclaude/dist/cli.mjs`  (the installed package)
 *   3. dev/user candidate paths (repo checkout, ~/.npm, npm .cmd shim)
 *   4. bare `openclaude` (defer to PATH at spawn time)
 *
 * When nothing concrete is found, `ensureInstalled()` runs
 * `npm i -g @gitlawb/openclaude`, streaming progress to the caller, then
 * re-resolves. The resolved path is cached until `invalidate()`.
 */

import { spawn, execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const OPENCLAUDE_PACKAGE = "@gitlawb/openclaude";

export interface OpenClaudeStatus {
  installed: boolean;
  /** Absolute path to cli.mjs (or a bare command deferred to PATH). */
  path: string | null;
  /** Whether `path` is a concrete existing file (vs a bare PATH command). */
  concrete: boolean;
  version?: string;
}

export class OpenClaudeManager {
  private static instance: OpenClaudeManager | null = null;
  private cachedPath: string | null = null;
  private installing: Promise<OpenClaudeStatus> | null = null;

  static getInstance(): OpenClaudeManager {
    if (!OpenClaudeManager.instance) {
      OpenClaudeManager.instance = new OpenClaudeManager();
    }
    return OpenClaudeManager.instance;
  }

  /** Drop the cached path so the next resolve re-scans (after an install). */
  invalidate(): void {
    this.cachedPath = null;
  }

  /** `npm root -g` (global node_modules), or null if npm is unavailable. */
  private npmRootGlobal(): string | null {
    try {
      const out = execFileSync(this.npmCommand(), ["root", "-g"], {
        encoding: "utf8",
        shell: process.platform === "win32",
        timeout: 15_000,
      });
      const dir = out.trim();
      return dir && fs.existsSync(dir) ? dir : null;
    } catch {
      return null;
    }
  }

  private npmCommand(): string {
    return process.platform === "win32" ? "npm.cmd" : "npm";
  }

  /** Concrete candidate paths, in priority order (excludes bare fallback). */
  private candidates(): string[] {
    const list: string[] = [];
    const envPath = process.env.OPENCLAUDE_CLI_PATH?.trim();
    if (envPath) list.push(envPath);

    const npmRoot = this.npmRootGlobal();
    if (npmRoot) {
      list.push(path.join(npmRoot, "@gitlawb", "openclaude", "dist", "cli.mjs"));
    }

    list.push(
      "C:\\Projects\\Teste\\openclaude\\dist\\cli.mjs",
      path.join(os.homedir(), ".npm", "openclaude", "dist", "cli.mjs"),
      path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules", "@gitlawb", "openclaude", "dist", "cli.mjs"),
      path.join(os.homedir(), "AppData", "Roaming", "npm", "openclaude.cmd"),
    );
    return list;
  }

  /**
   * Resolve the CLI path. Returns a concrete file when found, else the bare
   * `openclaude` command (PATH), else null when even that seems hopeless.
   */
  resolvePath(): string | null {
    if (this.cachedPath && (this.cachedPath === "openclaude" || fs.existsSync(this.cachedPath))) {
      return this.cachedPath;
    }
    for (const candidate of this.candidates()) {
      if (fs.existsSync(candidate)) {
        this.cachedPath = candidate;
        return candidate;
      }
    }
    // Last resort: bare command, PATH-resolved at spawn time.
    this.cachedPath = "openclaude";
    return this.cachedPath;
  }

  /** Whether a concrete cli.mjs / binary exists on disk. */
  private hasConcrete(): string | null {
    for (const candidate of this.candidates()) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  status(): OpenClaudeStatus {
    const concretePath = this.hasConcrete();
    if (concretePath) {
      return {
        installed: true,
        path: concretePath,
        concrete: true,
        version: this.readVersion(concretePath),
      };
    }
    // Maybe on PATH without a known concrete location.
    if (this.commandOnPath("openclaude")) {
      return { installed: true, path: "openclaude", concrete: false };
    }
    return { installed: false, path: null, concrete: false };
  }

  private commandOnPath(cmd: string): boolean {
    try {
      const probe = process.platform === "win32" ? "where" : "which";
      execFileSync(probe, [cmd], { stdio: "ignore", shell: process.platform === "win32", timeout: 8_000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Best-effort version read from the package.json next to dist/cli.mjs. */
  private readVersion(cliPath: string): string | undefined {
    try {
      const pkg = path.resolve(path.dirname(cliPath), "..", "package.json");
      if (fs.existsSync(pkg)) {
        return JSON.parse(fs.readFileSync(pkg, "utf8")).version;
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }

  /**
   * Ensure openclaude is installed. If already present, returns immediately.
   * Otherwise runs `npm i -g @gitlawb/openclaude`, streaming npm output lines
   * to `onProgress`. Concurrent calls share one install.
   */
  async ensureInstalled(
    onProgress?: (line: string) => void,
  ): Promise<OpenClaudeStatus> {
    const current = this.status();
    if (current.installed) return current;
    if (this.installing) return this.installing;

    this.installing = new Promise<OpenClaudeStatus>((resolve) => {
      onProgress?.(`Installing ${OPENCLAUDE_PACKAGE}…`);
      const child = spawn(
        this.npmCommand(),
        ["install", "-g", OPENCLAUDE_PACKAGE],
        { shell: process.platform === "win32", windowsHide: true },
      );
      const relay = (buf: Buffer) => {
        const text = buf.toString();
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed) onProgress?.(trimmed);
        }
      };
      child.stdout?.on("data", relay);
      child.stderr?.on("data", relay);
      child.on("error", (err) => {
        onProgress?.(`npm error: ${err.message}`);
        resolve({ installed: false, path: null, concrete: false });
      });
      child.on("close", (code) => {
        this.invalidate();
        if (code === 0) {
          const status = this.status();
          onProgress?.(
            status.installed
              ? `Installed openclaude${status.version ? " v" + status.version : ""}.`
              : "npm reported success but openclaude was not found on PATH.",
          );
          resolve(status);
        } else {
          onProgress?.(`npm install failed (exit ${code}).`);
          resolve({ installed: false, path: null, concrete: false });
        }
      });
    }).finally(() => {
      this.installing = null;
    });

    return this.installing;
  }
}
