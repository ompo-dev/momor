import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useStreamBuffer } from "../hooks/useStreamBuffer";
import { X, Copy, Check, ArrowUp, Zap, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import momorIcon from "./icon.png";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { ZedThreadMessage, ZedComposer } from "./zed";
import type { TFunction } from "i18next";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// ============================================
// Types
// ============================================

type AgentPermissionId = "read-only" | "auto-edit" | "full-access";

interface AgentCatalogEntry {
  id: string;
  name: string;
  transport: "acp" | "claude-stream-json" | "codex-exec";
  builtin: boolean;
  available: boolean;
}

const AGENT_PERMISSION_LABELS: Record<AgentPermissionId, string> = {
  "read-only": "Read-only",
  "auto-edit": "Auto-edit",
  "full-access": "Full access",
};

interface ToolCallCard {
  toolId: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "running" | "done" | "error";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCallCard[];
  costUsd?: number;
  isAgent?: boolean;
}

interface MeetingContext {
  id?: string; // Required for RAG queries
  title: string;
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  transcript?: Array<{ speaker: string; text: string; timestamp: number }>;
}

interface MeetingChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  meetingContext: MeetingContext;
  initialQuery?: string;
  onNewQuery: (query: string) => void;
}

type ChatState =
  | "idle"
  | "opening"
  | "waiting_for_llm"
  | "streaming_response"
  | "error"
  | "closing";

// ============================================
// Typing Indicator Component
// ============================================

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 py-4">
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-text-tertiary"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  </div>
);

// ============================================
// Agent Tool Call Card
// ============================================

const TOOL_LABELS: Record<string, string> = {
  // Meeting MCP tools
  get_transcript: "Reading transcript",
  query_rag: "Searching meeting content",
  get_screen_context: "Reading screen",
  get_meeting_metadata: "Getting meeting info",
  get_meeting_summary: "Reading summary",
  save_artifact: "Saving file",
  list_meeting_files: "Listing files",
  // CLI-native tools
  Write: "Writing file",
  Edit: "Editing file",
  MultiEdit: "Editing file",
  NotebookEdit: "Editing notebook",
  Read: "Reading file",
  Bash: "Running command",
  Glob: "Finding files",
  Grep: "Searching code",
  WebFetch: "Fetching web page",
  WebSearch: "Searching the web",
  Task: "Running sub-agent",
  Skill: "Using skill",
};

// Tools whose first argument is a meaningful one-line summary in the chip.
function toolArgPreview(tool: ToolCallCard): string {
  const a = tool.args || {};
  const pick = (a.path ?? a.file_path ?? a.command ?? a.pattern ?? a.query ?? Object.values(a)[0]);
  return typeof pick === "string" ? pick : "";
}

const AgentToolCallCard: React.FC<{ tool: ToolCallCard }> = ({ tool }) => {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[tool.name] ?? tool.name;
  const preview = toolArgPreview(tool);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-2 rounded-lg border text-[12px] ${
        tool.status === "error"
          ? "border-red-500/30 bg-red-500/[0.06]"
          : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-linear-ink-tertiary hover:text-linear-ink-secondary transition-colors"
      >
        {tool.status === "running" ? (
          <Loader2 size={12} className="animate-spin text-blue-400 shrink-0" />
        ) : tool.status === "error" ? (
          <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        )}
        <span className="font-medium">{label}</span>
        {preview && (
          <span className="ml-1 truncate opacity-50 font-mono">{preview}</span>
        )}
        <span className="ml-auto shrink-0">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>
      {expanded && tool.result && (
        <div className="border-t border-white/[0.06] px-3 py-2 font-mono text-[11px] text-linear-ink-tertiary whitespace-pre-wrap max-h-32 overflow-y-auto">
          {tool.result.slice(0, 600)}{tool.result.length > 600 ? "…" : ""}
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// Message Components
// ============================================

const UserMessage: React.FC<{ content: string }> = ({ content }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.15 }}
    className="mb-5"
  >
    <ZedThreadMessage role="user" label="You">
      {content}
    </ZedThreadMessage>
  </motion.div>
);

const AssistantMessage: React.FC<{
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCallCard[];
  costUsd?: number;
  isAgent?: boolean;
}> = ({ content, isStreaming, toolCalls, costUsd, isAgent }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="mb-5 flex w-full flex-col items-start"
    >
      <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {isAgent ? "Agent" : "Momor"}
      </span>
      {/* Tool calls rendered above the response */}
      {toolCalls && toolCalls.length > 0 && (
        <div className="w-full mb-3 max-w-[85%]">
          {toolCalls.map((tool) => (
            <AgentToolCallCard key={tool.toolId} tool={tool} />
          ))}
        </div>
      )}
      <div className="max-w-full text-[13px] leading-relaxed text-foreground">
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ node, ...props }: any) => (
                <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />
              ),
              a: ({ node, ...props }: any) => (
                <a className="text-blue-500 hover:underline" {...props} />
              ),
              pre: ({ children }: any) => (
                <div className="not-prose mb-4">{children}</div>
              ),
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = inline ?? false;
                const lang = match ? match[1] : "";

                return !isInline ? (
                  <div className="my-3 rounded-xl overflow-hidden border border-white/[0.08] shadow-lg bg-zinc-800/60 backdrop-blur-md">
                    <div className="bg-white/[0.04] px-3 py-1.5 border-b border-white/[0.08]">
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40 font-mono">
                        {lang || "CODE"}
                      </span>
                    </div>
                    <div className="bg-transparent">
                      <SyntaxHighlighter
                        language={lang || "text"}
                        style={vscDarkPlus}
                        customStyle={{
                          margin: 0,
                          borderRadius: 0,
                          fontSize: "13px",
                          lineHeight: "1.6",
                          background: "transparent",
                          padding: "16px",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}
                        wrapLongLines={true}
                        showLineNumbers={true}
                        lineNumberStyle={{
                          minWidth: "2.5em",
                          paddingRight: "1.2em",
                          color: "rgba(255,255,255,0.2)",
                          textAlign: "right",
                          fontSize: "11px",
                        }}
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                ) : (
                  <code
                    className="bg-bg-tertiary px-1.5 py-0.5 rounded text-[13px] font-mono text-text-primary border border-border-subtle whitespace-pre-wrap"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {isStreaming && (
          <motion.span
            className="inline-block w-0.5 h-4 bg-text-secondary ml-0.5 align-middle"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </div>
      {!isStreaming && content && (
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-[13px] text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {copied ? (
              <Check size={14} className="text-emerald-500" />
            ) : (
              <Copy size={14} />
            )}
            {copied
              ? t("meetingChat.copied")
              : t("meetingChat.copyMessage")}
          </button>
          {isAgent && costUsd !== undefined && costUsd > 0 && (
            <span className="text-[11px] text-linear-ink-tertiary opacity-60">
              ~${costUsd.toFixed(4)}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};

function formatStreamError(raw: string, t: TFunction): string {
  if (/API key not valid|API_KEY_INVALID|invalid.*api.*key/i.test(raw)) {
    return t("meetingChat.errorInvalidApiKey");
  }
  if (/No AI provider configured/i.test(raw)) {
    return t("meetingChat.errorNoProvider");
  }
  return t("meetingChat.errorCheckSettings");
}

// ============================================
// Main Component
// ============================================

const MeetingChatOverlay: React.FC<MeetingChatOverlayProps> = ({
  isOpen,
  onClose,
  meetingContext,
  initialQuery = "",
}) => {
  const { t } = useTranslation();
  const [inputQuery, setInputQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState(false);
  const [agentProvider, setAgentProvider] = useState<string>("openclaude");
  const [agentPermission, setAgentPermission] = useState<AgentPermissionId>("auto-edit");
  const [agentCatalog, setAgentCatalog] = useState<AgentCatalogEntry[]>([]);
  const [permissionRequest, setPermissionRequest] = useState<{
    id: string;
    tool: string;
    input: Record<string, unknown>;
  } | null>(null);
  const agentCleanupRef = useRef<Array<() => void>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const streamBuffer = useStreamBuffer();

  // Load persisted agent config + detect installed CLIs the first time the
  // user flips into Agent mode.
  useEffect(() => {
    if (!agentMode) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await window.electronAPI?.agentGetConfig?.();
        if (!cancelled && cfg?.config) {
          if (cfg.config.provider) setAgentProvider(String(cfg.config.provider));
          if (cfg.config.permissionMode)
            setAgentPermission(cfg.config.permissionMode as AgentPermissionId);
        }
        const list = await window.electronAPI?.agentGetProviders?.();
        if (!cancelled && (list as any)?.agents) {
          setAgentCatalog((list as any).agents as AgentCatalogEntry[]);
        }
      } catch {
        /* settings unavailable — keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentMode]);

  // Persist provider/permission changes so the main process picks them up.
  const updateAgentConfig = useCallback(
    (patch: { provider?: string; permissionMode?: AgentPermissionId }) => {
      void window.electronAPI?.agentSetConfig?.(patch);
    },
    [],
  );

  // Fine-grained approval requests from claude-style CLIs.
  useEffect(() => {
    const cleanup = window.electronAPI?.onAgentPermissionRequest?.((data) => {
      setPermissionRequest(data);
    });
    return () => cleanup?.();
  }, []);

  const respondPermission = useCallback(
    (allow: boolean) => {
      if (!permissionRequest) return;
      void window.electronAPI?.agentRespondPermission?.({
        id: permissionRequest.id,
        allow,
        message: allow ? undefined : "Denied by user",
      });
      setPermissionRequest(null);
    },
    [permissionRequest],
  );

  // Submit initial query when overlay opens
  useEffect(() => {
    if (isOpen && initialQuery && messages.length === 0) {
      setChatState("opening");
      setTimeout(() => {
        submitQuestion(initialQuery);
      }, 100);
    }
  }, [isOpen, initialQuery]);

  // Listen for new queries from parent
  useEffect(() => {
    if (isOpen && initialQuery && messages.length > 0) {
      // This is a follow-up query
      submitQuestion(initialQuery);
    }
  }, [initialQuery]);

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setChatState("idle");
      setMessages([]);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click outside handler
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, []);

  const handleClose = useCallback(() => {
    setInputQuery("");
    onClose();
  }, [onClose]);

  // Build context string for LLM
  const buildContextString = useCallback((): string => {
    const parts: string[] = [];

    parts.push(`MEETING: ${meetingContext.title}`);

    if (meetingContext.summary) {
      parts.push(`\nSUMMARY:\n${meetingContext.summary}`);
    }

    if (meetingContext.keyPoints?.length) {
      parts.push(
        `\nKEY POINTS:\n${meetingContext.keyPoints.map((p) => `- ${p}`).join("\n")}`,
      );
    }

    if (meetingContext.actionItems?.length) {
      parts.push(
        `\nACTION ITEMS:\n${meetingContext.actionItems.map((a) => `- ${a}`).join("\n")}`,
      );
    }

    if (meetingContext.transcript?.length) {
      const recentTranscript = meetingContext.transcript.slice(-20);
      const transcriptText = recentTranscript
        .map((t) => `[${t.speaker === "user" ? "Me" : "Them"}]: ${t.text}`)
        .join("\n");
      parts.push(`\nRECENT TRANSCRIPT:\n${transcriptText}`);
    }

    return parts.join("\n");
  }, [meetingContext]);

  // Agent mode cleanup on close
  useEffect(() => {
    if (!isOpen) {
      agentCleanupRef.current.forEach((fn) => fn());
      agentCleanupRef.current = [];
      window.electronAPI?.agentCancel?.();
    }
  }, [isOpen]);

  // Submit using external CLI agent (openclaude / opencode / codex)
  const submitAgentQuestion = useCallback(
    async (question: string) => {
      // Cancel any previous agent stream
      await window.electronAPI?.agentCancel?.();
      agentCleanupRef.current.forEach((fn) => fn());
      agentCleanupRef.current = [];

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
      };
      setMessages((prev) => [...prev, userMessage]);
      setChatState("waiting_for_llm");
      setErrorMessage(null);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);

      const assistantId = `assistant-${Date.now()}`;
      await new Promise((resolve) => setTimeout(resolve, 200));

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          isStreaming: true,
          toolCalls: [],
          isAgent: true,
        },
      ]);

      streamBuffer.reset();

      // Track tool calls for this message
      const activeToolCalls = new Map<string, ToolCallCard>();

      const tokenCleanup = window.electronAPI?.onAgentStreamToken?.((token) => {
        setChatState("streaming_response");
        streamBuffer.appendToken(token, (content) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content } : msg,
            ),
          );
        });
      });

      const toolCallCleanup = window.electronAPI?.onAgentToolCall?.((data) => {
        const card: ToolCallCard = {
          toolId: data.toolId,
          name: data.name,
          args: data.args ?? {},
          status: "running",
        };
        activeToolCalls.set(data.toolId, card);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, toolCalls: [...activeToolCalls.values()] }
              : msg,
          ),
        );
      });

      const toolResultCleanup = window.electronAPI?.onAgentToolResult?.((data) => {
        const card = activeToolCalls.get(data.toolId);
        if (card) {
          card.result = data.result;
          card.status = data.isError ? "error" : "done";
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, toolCalls: [...activeToolCalls.values()] }
                : msg,
            ),
          );
        }
      });

      const sessionCleanup = window.electronAPI?.onAgentStreamSession?.(() => {
        // CLI session id captured by the main process for multi-turn continuity.
        // Nothing to render; kept so the listener is registered + cleaned up.
      });

      const doneCleanup = window.electronAPI?.onAgentStreamDone?.((data) => {
        const finalContent = streamBuffer.getBufferedContent();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: finalContent || data.fullText || msg.content,
                  isStreaming: false,
                  costUsd: data.costUsd,
                }
              : msg,
          ),
        );
        setChatState("idle");
        streamBuffer.reset();
        cleanup();
      });

      const errorCleanup = window.electronAPI?.onAgentStreamError?.((data) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
        setErrorMessage(data.error || "Agent error");
        setChatState("error");
        streamBuffer.reset();
        cleanup();
      });

      const cleanup = () => {
        tokenCleanup?.();
        toolCallCleanup?.();
        toolResultCleanup?.();
        sessionCleanup?.();
        doneCleanup?.();
        errorCleanup?.();
        agentCleanupRef.current = [];
      };
      agentCleanupRef.current = [cleanup];

      // Build system prompt with meeting context. The agent also has live MCP
      // tools (transcript, RAG, screen, save_artifact) and can write into a
      // per-meeting workspace.
      const contextString = buildContextString();
      const systemPrompt = `You are an AI agent helping during a live meeting. You can use the momor-meeting MCP tools to read the live transcript, search meeting content, read the screen, and save files (save_artifact) into the meeting workspace. You can also use your own file/command tools to create and edit files in the workspace. Be concise and do what the user asks.

${contextString}`;

      await window.electronAPI?.agentChatStream?.({
        message: question,
        meetingId: meetingContext.id,
        meetingTitle: meetingContext.title,
        provider: agentProvider,
        systemPrompt,
      });
    },
    [chatState, buildContextString, meetingContext, streamBuffer, agentProvider],
  );

  // Submit question using RAG streaming
  const submitQuestion = useCallback(
    async (question: string) => {
      if (
        !question.trim() ||
        chatState === "waiting_for_llm" ||
        chatState === "streaming_response"
      )
        return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
      };
      setMessages((prev) => [...prev, userMessage]);
      setChatState("waiting_for_llm");
      setErrorMessage(null);

      // Scroll to bottom when user sends message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);

      const assistantMessageId = `assistant-${Date.now()}`;

      try {
        // Add typing indicator delay (200ms) - makes the AI feel "thoughtful"
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Create assistant message placeholder
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            isStreaming: true,
          },
        ]);

        // Set up RAG streaming listeners (RAF-batched to avoid per-token re-renders)
        streamBuffer.reset();
        const tokenCleanup = window.electronAPI?.onRAGStreamChunk(
          (data: { chunk: string }) => {
            setChatState("streaming_response");
            streamBuffer.appendToken(data.chunk, (content) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content } : msg,
                ),
              );
            });
          },
        );

        const doneCleanup = window.electronAPI?.onRAGStreamComplete(() => {
          // Final commit — flush any remaining buffered content
          const finalContent = streamBuffer.getBufferedContent();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: finalContent, isStreaming: false }
                : msg,
            ),
          );
          setChatState("idle");
          streamBuffer.reset();
          tokenCleanup?.();
          doneCleanup?.();
          errorCleanup?.();
        });

        const errorCleanup = window.electronAPI?.onRAGStreamError(
          (data: { error: string }) => {
            console.error("[MeetingChat] RAG stream error:", data.error);
            setMessages((prev) =>
              prev.filter((msg) => msg.id !== assistantMessageId),
            );
            setErrorMessage(t("meetingChat.errorNoResponse"));
            setChatState("error");
            streamBuffer.reset();
            tokenCleanup?.();
            doneCleanup?.();
            errorCleanup?.();
          },
        );

        // Get meeting ID from context for RAG queries
        const meetingId = meetingContext.id;

        if (meetingId) {
          // Use RAG-powered meeting query
          const result = await window.electronAPI?.ragQueryMeeting(
            meetingId,
            question,
          );

          // If RAG not available (or failed), fall back to context-window chat
          if (result?.fallback) {
            console.log(
              "[MeetingChat] RAG unavailable, using context window fallback",
            );
            // Cleanup RAG listeners since we won't use them
            tokenCleanup?.();
            doneCleanup?.();
            errorCleanup?.();

            // FALLBACK LOGIC
            const contextString = buildContextString();
            const systemPrompt = `You are recalling a specific meeting. Answer questions ONLY about this meeting. Be concise (2-4 sentences). Sound natural, like a human recalling. If information is not present, say so briefly. Never guess.

${contextString}`;

            streamBuffer.reset();
            const oldTokenCleanup = window.electronAPI?.onGeminiStreamToken(
              (token: string) => {
                setChatState("streaming_response");
                streamBuffer.appendToken(token, (content) => {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content } : msg,
                    ),
                  );
                });
              },
            );

            const oldDoneCleanup = window.electronAPI?.onGeminiStreamDone(
              () => {
                const finalContent = streamBuffer.getBufferedContent();
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: finalContent, isStreaming: false }
                      : msg,
                  ),
                );
                streamBuffer.reset();
                oldTokenCleanup?.();
                oldDoneCleanup?.();
                oldErrorCleanup?.();
              },
            );

            const oldErrorCleanup = window.electronAPI?.onGeminiStreamError(
              (error: string) => {
                console.error(
                  "[MeetingChat] Gemini stream error (fallback):",
                  error,
                );
                setMessages((prev) =>
                  prev.filter((msg) => msg.id !== assistantMessageId),
                );
                setErrorMessage(formatStreamError(error, t));
                setChatState("error");
                streamBuffer.reset();
                oldTokenCleanup?.();
                oldDoneCleanup?.();
                oldErrorCleanup?.();
              },
            );

            await window.electronAPI?.streamGeminiChat(
              question,
              undefined,
              systemPrompt,
              { skipSystemPrompt: true, ignoreKnowledgeMode: true },
            );
          }
        } else {
          // No meeting ID, standard fallback
          const contextString = buildContextString();
          const systemPrompt = `You are recalling a specific meeting. Answer questions ONLY about this meeting. Be concise (2-4 sentences). Sound natural, like a human recalling. If information is not present, say so briefly. Never guess.

${contextString}`;

          // Switch to Gemini streaming (RAF-batched)
          streamBuffer.reset();
          const oldTokenCleanup = window.electronAPI?.onGeminiStreamToken(
            (token: string) => {
              setChatState("streaming_response");
              streamBuffer.appendToken(token, (content) => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, content } : msg,
                  ),
                );
              });
            },
          );

          const oldDoneCleanup = window.electronAPI?.onGeminiStreamDone(() => {
            const finalContent = streamBuffer.getBufferedContent();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: finalContent, isStreaming: false }
                  : msg,
              ),
            );
            setChatState("idle");
            streamBuffer.reset();
            oldTokenCleanup?.();
            oldDoneCleanup?.();
            oldErrorCleanup?.();
          });

          const oldErrorCleanup = window.electronAPI?.onGeminiStreamError(
            (error: string) => {
              console.error("[MeetingChat] Gemini stream error:", error);
              setMessages((prev) =>
                prev.filter((msg) => msg.id !== assistantMessageId),
              );
              setErrorMessage(formatStreamError(error, t));
              setChatState("error");
              streamBuffer.reset();
              oldTokenCleanup?.();
              oldDoneCleanup?.();
              oldErrorCleanup?.();
            },
          );

          await window.electronAPI?.streamGeminiChat(
            question,
            undefined,
            systemPrompt,
            { skipSystemPrompt: true, ignoreKnowledgeMode: true },
          );
        }
      } catch (error) {
        console.error("[MeetingChat] Error:", error);
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId),
        );
        setErrorMessage(t("meetingChat.errorGeneric"));
        setChatState("error");
      }
    },
    [chatState, buildContextString, meetingContext, t],
  );

  const handleSubmit = useCallback(
    (question: string) => {
      if (!question.trim()) return;
      if (agentMode) {
        void submitAgentQuestion(question);
      } else {
        void submitQuestion(question);
      }
    },
    [agentMode, submitAgentQuestion, submitQuestion],
  );

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputQuery.trim()) {
      e.preventDefault();
      handleSubmit(inputQuery.trim());
      setInputQuery("");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="absolute inset-0 z-40 flex flex-col justify-end"
          onClick={handleBackdropClick}
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(8px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 bg-black/40"
          />

          {/* Chat Window - extends to bottom, leaves room for input */}
          <motion.div
            ref={chatWindowRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "85vh", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: {
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 0.8,
              },
              opacity: { duration: 0.2 },
            }}
            className="relative mx-auto mb-0 flex w-full max-w-[680px] flex-col overflow-hidden rounded-t-[24px] border-x border-t border-linear-hairline bg-linear-surface-1 text-linear-ink shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 flex-col gap-2 border-b border-linear-hairline px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-linear-ink-tertiary">
                  <img
                    src={momorIcon}
                    className="force-black-icon h-3.5 w-3.5 opacity-50"
                    alt=""
                  />
                  <span className="text-[13px] font-medium">
                    {agentMode ? "Agent Mode" : t("meetingChat.searchThisMeeting")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Agent mode toggle */}
                  <button
                    onClick={() => setAgentMode((v) => !v)}
                    title={agentMode ? "Switch to RAG mode" : "Switch to Agent mode (uses CLI tools + MCPs)"}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      agentMode
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-transparent text-linear-ink-tertiary hover:text-linear-ink-secondary border border-transparent hover:border-linear-hairline"
                    }`}
                  >
                    <Zap size={11} className={agentMode ? "text-violet-300" : ""} />
                    Agent
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-8 w-8"
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>

              {/* External Agent (CLI) + permission selectors. These are the
                  agents that run under the hood — separate from the API/local
                  LLM the rest of the app uses for plain chat. */}
              {agentMode && (
                <div className="flex items-center gap-2 text-[11px]">
                  <select
                    value={agentProvider}
                    onChange={(e) => {
                      const p = e.target.value;
                      setAgentProvider(p);
                      updateAgentConfig({ provider: p });
                    }}
                    className="rounded-md border border-linear-hairline bg-transparent px-2 py-1 text-linear-ink-secondary focus:outline-none"
                    title="External CLI agent — runs under the hood like opening a terminal"
                  >
                    <optgroup label="External Agents">
                      {agentCatalog.map((a) => (
                        <option key={a.id} value={a.id} disabled={!a.available}>
                          {a.name}
                          {!a.available ? " (not found)" : ""}
                          {a.transport === "acp" ? " · ACP" : ""}
                        </option>
                      ))}
                      {agentCatalog.length === 0 &&
                        ["openclaude", "claude", "opencode", "codex"].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                    </optgroup>
                  </select>
                  <select
                    value={agentPermission}
                    onChange={(e) => {
                      const m = e.target.value as AgentPermissionId;
                      setAgentPermission(m);
                      updateAgentConfig({ permissionMode: m });
                    }}
                    className="rounded-md border border-linear-hairline bg-transparent px-2 py-1 text-linear-ink-secondary focus:outline-none"
                    title="What the agent is allowed to do on your machine"
                  >
                    {(["read-only", "auto-edit", "full-access"] as AgentPermissionId[]).map((m) => (
                      <option key={m} value={m}>{AGENT_PERMISSION_LABELS[m]}</option>
                    ))}
                  </select>
                  {agentPermission === "full-access" && (
                    <span className="text-amber-400/80">⚠ full machine access</span>
                  )}
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 px-6 py-4 pb-32">
              <div className="pr-2">
                {messages.map((msg) =>
                  msg.role === "user" ? (
                    <UserMessage key={msg.id} content={msg.content} />
                  ) : (
                    <AssistantMessage
                      key={msg.id}
                      content={msg.content}
                      isStreaming={msg.isStreaming}
                      toolCalls={msg.toolCalls}
                      costUsd={msg.costUsd}
                      isAgent={msg.isAgent}
                    />
                  ),
                )}

                {chatState === "waiting_for_llm" && <TypingIndicator />}

                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
                  >
                    {errorMessage}
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-50 flex justify-center bg-gradient-to-t from-linear-surface-1 via-linear-surface-1/90 to-transparent p-4">
              <div className="pointer-events-auto w-full max-w-[560px]">
                <ZedComposer
                  value={inputQuery}
                  onChange={setInputQuery}
                  onSubmit={() => {
                    if (inputQuery.trim()) {
                      handleSubmit(inputQuery.trim());
                      setInputQuery("");
                    }
                  }}
                  disabled={
                    chatState === "waiting_for_llm" ||
                    chatState === "streaming_response"
                  }
                  placeholder={
                    agentMode
                      ? "Message agent — @ context, / commands"
                      : t("meetingDetails.askPlaceholder")
                  }
                />
              </div>
            </div>

            {/* Fine-grained permission approval (claude-style CLIs) */}
            <AnimatePresence>
              {permissionRequest && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-6"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    className="w-full max-w-[380px] rounded-2xl border border-linear-hairline bg-linear-surface-1 p-5 shadow-2xl"
                  >
                    <div className="text-[14px] font-semibold text-linear-ink">
                      Allow agent action?
                    </div>
                    <div className="mt-1 text-[12px] text-linear-ink-tertiary">
                      The agent wants to use{" "}
                      <span className="font-mono text-linear-ink-secondary">
                        {permissionRequest.tool}
                      </span>
                      .
                    </div>
                    {Object.keys(permissionRequest.input || {}).length > 0 && (
                      <pre className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 font-mono text-[11px] text-linear-ink-tertiary whitespace-pre-wrap">
                        {JSON.stringify(permissionRequest.input, null, 2).slice(0, 600)}
                      </pre>
                    )}
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => respondPermission(false)}>
                        Deny
                      </Button>
                      <Button size="sm" onClick={() => respondPermission(true)}>
                        Allow
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MeetingChatOverlay;
