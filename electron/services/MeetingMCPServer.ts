/**
 * MeetingMCPServer — local MCP server (SSE transport) that exposes live meeting
 * context as tools to MCP-capable CLI agents (claude / openclaude). Started once
 * at app boot on 127.0.0.1:19876; agents receive the URL via a temp MCP config.
 *
 * Read tools:
 *   get_transcript        — recent transcript from SessionTracker
 *   query_rag             — semantic search over indexed meeting content
 *   get_screen_context    — latest screen-understanding result (vision-first)
 *   get_meeting_metadata  — title, mode, active state, meeting id
 *   get_meeting_summary   — structured summary / action items when available
 * Write tools (scoped to the current agent workspace):
 *   save_artifact         — write a file inside the workspace
 *   list_meeting_files    — list artifacts already created in the workspace
 *   request_permission    — fine-grained approval hook (claude --permission-prompt-tool)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response } from "express";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { WorkspaceManager } from "./agent/WorkspaceManager";

export interface MeetingContextCallbacks {
  getTranscript: (seconds?: number) => string;
  queryRAG: (query: string, meetingId?: string) => Promise<string>;
  getScreenContext: () => string;
  getMeetingMetadata: () => {
    title: string;
    isActive: boolean;
    mode?: string;
    meetingId?: string;
  };
  getMeetingSummary?: () => string;
  /** Resolve a permission request; defaults to deny when unset. */
  requestPermission?: (req: {
    tool: string;
    input: Record<string, unknown>;
  }) => Promise<{ allow: boolean; message?: string }>;
}

export const MEETING_MCP_PORT = 19876;

const TOOLS = [
  {
    name: "get_transcript",
    description:
      "Get the recent meeting transcript. Returns spoken text from the last N seconds of the meeting.",
    inputSchema: {
      type: "object" as const,
      properties: {
        seconds: {
          type: "number",
          description: "How many seconds of transcript to retrieve (default 180)",
        },
      },
    },
  },
  {
    name: "query_rag",
    description:
      "Semantically search the indexed meeting content. Use this to find specific topics, decisions, or information mentioned earlier in the meeting.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query" },
        meeting_id: { type: "string", description: "Optional meeting ID to scope the search" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_screen_context",
    description:
      "Get the latest understanding of what is visible on the user's screen (code, slides, documents shown during the meeting).",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_meeting_metadata",
    description: "Get metadata about the current meeting: title, active state, mode, and meeting ID.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_meeting_summary",
    description: "Get the structured summary and action items for the current meeting, when available.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "save_artifact",
    description:
      "Create or overwrite a file inside the meeting workspace. Use this to save generated documents (e.g. an HTML page summarizing the meeting). Paths are relative to the workspace and cannot escape it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative path within the workspace, e.g. 'summary/index.html'" },
        content: { type: "string", description: "Full file content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_meeting_files",
    description: "List files that already exist in the meeting workspace.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "request_permission",
    description:
      "Internal approval hook. Returns whether a sensitive action is permitted by the user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tool_name: { type: "string" },
        input: { type: "object" },
      },
    },
  },
];

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

export class MeetingMCPServer {
  private static instance: MeetingMCPServer | null = null;
  private httpServer: http.Server | null = null;
  private callbacks: MeetingContextCallbacks | null = null;
  private transports: Map<string, SSEServerTransport> = new Map();
  /** Workspace the current agent run may write into via save_artifact. */
  private activeWorkspace: string | null = null;

  private constructor() {}

  static getInstance(): MeetingMCPServer {
    if (!MeetingMCPServer.instance) {
      MeetingMCPServer.instance = new MeetingMCPServer();
    }
    return MeetingMCPServer.instance;
  }

  setCallbacks(callbacks: MeetingContextCallbacks): void {
    this.callbacks = callbacks;
  }

  setActiveWorkspace(dir: string | null): void {
    this.activeWorkspace = dir;
  }

  private async handleCall(name: string, args: any): Promise<any> {
    const cb = this.callbacks;
    if (!cb && name !== "request_permission") {
      return text("Meeting context not available");
    }

    switch (name) {
      case "get_transcript":
        return text(cb!.getTranscript((args?.seconds as number) ?? 180) || "[No transcript available yet]");

      case "query_rag": {
        const result = await cb!.queryRAG(args?.query as string, args?.meeting_id as string | undefined);
        return text(result || "[No relevant content found]");
      }

      case "get_screen_context":
        return text(cb!.getScreenContext() || "[No screen context available]");

      case "get_meeting_metadata":
        return text(JSON.stringify(cb!.getMeetingMetadata(), null, 2));

      case "get_meeting_summary":
        return text(cb!.getMeetingSummary?.() || "[No summary available yet]");

      case "save_artifact": {
        if (!this.activeWorkspace) return { ...text("No active workspace to write into."), isError: true };
        const rel = String(args?.path ?? "");
        const content = String(args?.content ?? "");
        if (!rel) return { ...text("Missing 'path'."), isError: true };
        try {
          const abs = WorkspaceManager.getInstance().safeResolve(this.activeWorkspace, rel);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, content, "utf8");
          return text(`Saved ${rel} (${content.length} bytes) to the meeting workspace.`);
        } catch (err: any) {
          return { ...text(`save_artifact failed: ${err?.message}`), isError: true };
        }
      }

      case "list_meeting_files": {
        if (!this.activeWorkspace) return text("[No active workspace]");
        try {
          const out: string[] = [];
          const walk = (dir: string, prefix: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (entry.name === "opencode.json") continue;
              const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
              if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
              else out.push(rel);
            }
          };
          walk(this.activeWorkspace, "");
          return text(out.length ? out.join("\n") : "[Workspace is empty]");
        } catch (err: any) {
          return { ...text(`list_meeting_files failed: ${err?.message}`), isError: true };
        }
      }

      case "request_permission": {
        const decision = cb?.requestPermission
          ? await cb.requestPermission({
              tool: String(args?.tool_name ?? "unknown"),
              input: (args?.input as Record<string, unknown>) ?? {},
            })
          : { allow: false, message: "No approver configured" };
        // Shape expected by claude --permission-prompt-tool.
        return text(
          JSON.stringify(
            decision.allow
              ? { behavior: "allow", updatedInput: args?.input ?? {} }
              : { behavior: "deny", message: decision.message ?? "Denied by user" },
          ),
        );
      }

      default:
        return { ...text(`Unknown tool: ${name}`), isError: true };
    }
  }

  async start(): Promise<void> {
    if (this.httpServer) return;
    const app = express();

    app.get("/sse", async (_req: Request, res: Response) => {
      const transport = new SSEServerTransport("/message", res);
      const sessionId = transport.sessionId;
      this.transports.set(sessionId, transport);

      const server = new Server(
        { name: "momor-meeting", version: "1.0.0" },
        { capabilities: { tools: {} } },
      );

      server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
          return await this.handleCall(request.params.name, request.params.arguments);
        } catch (err: any) {
          return { ...text(`Tool error: ${err?.message}`), isError: true };
        }
      });

      res.on("close", () => this.transports.delete(sessionId));
      await server.connect(transport);
    });

    app.post("/message", express.json(), async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      const transport = this.transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      await transport.handlePostMessage(req, res, req.body);
    });

    this.httpServer = http.createServer(app);
    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(MEETING_MCP_PORT, "127.0.0.1", () => {
        console.log(`[MeetingMCP] Server running on http://127.0.0.1:${MEETING_MCP_PORT}`);
        resolve();
      }).on("error", reject);
    });
  }

  stop(): void {
    this.httpServer?.close();
    this.httpServer = null;
    this.transports.clear();
  }

  /** MCP config consumed by claude/openclaude via --mcp-config. */
  getMcpConfigJson(): object {
    return {
      mcpServers: {
        "momor-meeting": {
          type: "sse",
          url: `http://127.0.0.1:${MEETING_MCP_PORT}/sse`,
        },
      },
    };
  }
}
