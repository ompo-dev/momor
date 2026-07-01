/**
 * AcpClient — minimal JSON-RPC 2.0 peer over a child process's stdio using
 * newline-delimited JSON, as spoken by ACP (Agent Client Protocol) agents:
 * `opencode acp`, `claude-code-acp`, `codex-acp`, `gemini --experimental-acp`,
 * and any custom agent the user adds (Zed's "Add More Agents").
 *
 * Both sides can send requests: we call agent methods (initialize,
 * session/new, session/prompt) and the agent calls client methods back
 * (fs/read_text_file, fs/write_text_file, session/request_permission).
 * Hand-rolled to avoid new runtime dependencies; the protocol is ndjson.
 */

import { ChildProcess } from "child_process";

type Json = any;

export interface AcpIncomingRequest {
  method: string;
  params: Json;
}

export type AcpRequestHandler = (req: AcpIncomingRequest) => Promise<Json>;
export type AcpNotificationHandler = (method: string, params: Json) => void;

export class AcpError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: Json,
  ) {
    super(message);
    this.name = "AcpError";
  }
}

export class AcpClient {
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: Json) => void; reject: (e: Error) => void }
  >();
  private buffer = "";
  private closed = false;

  onRequest: AcpRequestHandler = async ({ method }) => {
    throw new AcpError(-32601, `Client method not implemented: ${method}`);
  };
  onNotification: AcpNotificationHandler = () => {};
  onClose: (error?: Error) => void = () => {};

  constructor(private readonly proc: ChildProcess) {
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk: string) => this.onData(chunk));
    proc.on("error", (err) => this.teardown(err));
    proc.on("close", () => this.teardown());
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: Json;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        continue; // stray log line on stdout
      }
      void this.dispatch(msg);
    }
  }

  private async dispatch(msg: Json): Promise<void> {
    if (!msg || typeof msg !== "object") return;

    // Response to one of our requests.
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(
            new AcpError(msg.error.code ?? -32603, msg.error.message ?? "Agent error", msg.error.data),
          );
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Agent → client request.
    if (msg.id !== undefined && typeof msg.method === "string") {
      try {
        const result = await this.onRequest({ method: msg.method, params: msg.params });
        this.send({ jsonrpc: "2.0", id: msg.id, result: result ?? null });
      } catch (err: any) {
        const code = err instanceof AcpError ? err.code : -32603;
        this.send({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code, message: err?.message ?? "Internal error" },
        });
      }
      return;
    }

    // Notification.
    if (typeof msg.method === "string") {
      try {
        this.onNotification(msg.method, msg.params);
      } catch (err) {
        console.warn("[AcpClient] notification handler failed:", err);
      }
    }
  }

  private send(msg: Json): void {
    if (this.closed) return;
    try {
      this.proc.stdin?.write(JSON.stringify(msg) + "\n");
    } catch (err: any) {
      this.teardown(err);
    }
  }

  request(method: string, params?: Json, timeoutMs = 120_000): Promise<Json> {
    if (this.closed) {
      return Promise.reject(new Error("ACP connection is closed"));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error(`ACP request timed out: ${method}`));
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.send({ jsonrpc: "2.0", id, method, params: params ?? {} });
    });
  }

  notify(method: string, params?: Json): void {
    this.send({ jsonrpc: "2.0", method, params: params ?? {} });
  }

  get alive(): boolean {
    return !this.closed;
  }

  private teardown(error?: Error): void {
    if (this.closed) return;
    this.closed = true;
    for (const [, p] of this.pending) {
      p.reject(error ?? new Error("ACP agent process exited"));
    }
    this.pending.clear();
    this.onClose(error);
  }

  dispose(): void {
    this.teardown();
    if (!this.proc.killed) {
      try { this.proc.kill("SIGTERM"); } catch {}
    }
  }
}
