import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileSearch,
  Wrench,
  FolderOpen,
} from "lucide-react";
import { useStreamBuffer } from "../hooks/useStreamBuffer";
import {
  hasExplicitLocalPath,
  shouldUseAgentSession,
} from "../lib/localPathDetection";
import { ScrollArea } from "./ui/scroll-area";
import { ZedThreadMessage, ZedComposer } from "./zed";
import { ZedIconButton } from "./zed/ZedIconButton";
import { ZedListItem } from "./zed/ZedListItem";
import { Button } from "./ui/button";
import { Callout } from "./ui/callout";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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

interface GlobalChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

type AgentPermissionRequest = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
};

type ChatState = "idle" | "waiting_for_llm" | "streaming_response" | "error";

function buildGlobalAgentSystemPrompt(explicitLocalPath = false): string {
  return [
    "You are momor, a helpful AI assistant developed by ompo-dev.",
    "This global search panel can use local agent tools with filesystem, MCP, skill, and shell access.",
    explicitLocalPath
      ? "The user intentionally shared an explicit local path in this turn. Inspect the real file or folder before answering."
      : "Use filesystem, shell, MCP, and skill tools whenever they help with local files, code, or project state.",
    explicitLocalPath
      ? "Treat the referenced path as the priority context for this turn."
      : "",
    "If the host or a tool already read a referenced file, answer from that real file content instead of asking the user to paste it again.",
    "When the user asks to create, edit, rename, move, or delete local files, perform the action directly with tools when the session allows it.",
    "Do not claim you lack access unless a tool call actually fails.",
    "Answer directly and keep the response grounded in what you inspected.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeStreamError(error: string): string {
  const raw = String(error ?? "").trim();
  if (!raw) return "Unknown error.";
  return raw
    .replace(/^\[?Error:\s*/i, "")
    .replace(/\]$/, "")
    .trim();
}

function humanizeGlobalError(error: string, isPortuguese: boolean): string {
  const normalized = normalizeStreamError(error);

  if (/spawn\s+ENAMETOOLONG/i.test(normalized)) {
    return isPortuguese
      ? "O runtime local do agente nao conseguiu iniciar o comando. Isso normalmente indica um caminho invalido do agente ou uma configuracao antiga em Integracoes."
      : "The local agent runtime could not start the command. This usually means an invalid agent path or stale Integrations config.";
  }

  if (
    /spawn\s+.+\s+ENOENT|failed to launch.+ENOENT|no executable found/i.test(
      normalized,
    )
  ) {
    return isPortuguese
      ? "O runtime local do agente nao foi encontrado. Revise o caminho configurado em Integracoes."
      : "The local agent runtime was not found. Check the configured path in Integrations.";
  }

  if (/produced no output|no output/i.test(normalized)) {
    return isPortuguese
      ? "O agente iniciou, mas o backend nao retornou resposta. Revise o provider ou modelo escolhido em Integracoes e tente novamente."
      : "The agent started, but the backend returned no response. Check the configured provider or model in Integrations and try again.";
  }

  return normalized;
}

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 py-4">
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-text-tertiary"
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

const PanelBadge: React.FC<{
  children: React.ReactNode;
  active?: boolean;
}> = ({ children, active = false }) => (
  <span
    className={`inline-flex items-center rounded-sm border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] ${
      active
        ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
        : "border-border-subtle/80 bg-background/40 text-text-tertiary"
    }`}
  >
    {children}
  </span>
);

const TOOL_LABELS: Record<string, string> = {
  get_transcript: "Reading transcript",
  query_rag: "Searching meeting content",
  get_screen_context: "Reading screen",
  get_meeting_metadata: "Getting meeting info",
  get_meeting_summary: "Reading summary",
  save_artifact: "Saving file",
  list_meeting_files: "Listing files",
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

function toolArgPreview(tool: ToolCallCard): string {
  const args = tool.args || {};
  const pick =
    args.path ??
    args.file_path ??
    args.command ??
    args.pattern ??
    args.query ??
    Object.values(args)[0];
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
      className={`mb-1.5 rounded-sm border text-[12px] ${
        tool.status === "error"
          ? "border-red-500/25 bg-red-500/8"
          : "border-border-subtle/80 bg-background/18"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-text-tertiary transition-colors hover:text-text-secondary"
      >
        {tool.status === "running" ? (
          <Loader2 size={12} className="shrink-0 animate-spin text-blue-400" />
        ) : tool.status === "error" ? (
          <div className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
        ) : (
          <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        )}
        <span className="font-medium text-text-secondary">{label}</span>
        {preview ? (
          <span className="ml-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] opacity-60">
            {preview}
          </span>
        ) : null}
        <span className="ml-auto shrink-0">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>
      {expanded && tool.result ? (
        <div className="max-h-32 overflow-y-auto border-t border-border-subtle/80 bg-background/28 px-2.5 py-2 font-mono text-[11px] text-text-tertiary whitespace-pre-wrap">
          {tool.result.slice(0, 600)}
          {tool.result.length > 600 ? "..." : ""}
        </div>
      ) : null}
    </motion.div>
  );
};

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
  const { i18n } = useTranslation();
  const isPortuguese = i18n.language.startsWith("pt");
  const [copied, setCopied] = useState(false);
  const copyLabel = copied
    ? isPortuguese
      ? "Copiado"
      : "Copied"
    : isPortuguese
      ? "Copiar resposta"
      : "Copy answer";
  const agentLabel = isAgent ? (isPortuguese ? "Agente" : "Agent") : "Momor";

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
      {toolCalls && toolCalls.length > 0 ? (
        <div className="mb-3 w-full max-w-full">
          {toolCalls.map((tool) => (
            <AgentToolCallCard key={tool.toolId} tool={tool} />
          ))}
        </div>
      ) : null}

      <ZedThreadMessage
        role="agent"
        label={agentLabel}
        actions={
          !isStreaming && content ? (
            <ZedIconButton
              onClick={handleCopy}
              icon={copied ? <Check className="text-emerald-500" /> : <Copy />}
              size="sm"
              aria-label={copyLabel}
              title={copyLabel}
            />
          ) : undefined
        }
        className="max-w-full"
      >
        <div className="markdown-content max-w-full text-[13px] leading-relaxed text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ node, ...props }: any) => (
                <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />
              ),
              a: ({ node, ...props }: any) => (
                <a className="text-primary hover:underline" {...props} />
              ),
              pre: ({ children }: any) => (
                <div className="not-prose mb-4">{children}</div>
              ),
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || "");
                const language = match ? match[1] : "";
                const isInline = inline ?? false;

                return !isInline ? (
                  <div className="my-3 overflow-hidden rounded-md border border-border-subtle/80 bg-secondary/30">
                    <div className="border-b border-border-subtle/80 px-3 py-1.5">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                        {language || "code"}
                      </span>
                    </div>
                    <div className="bg-transparent">
                      <SyntaxHighlighter
                        language={language || "text"}
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
                          color: "rgba(255,255,255,0.24)",
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
                    className="whitespace-pre-wrap rounded border border-border-subtle bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-text-primary"
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
          {isStreaming ? (
            <motion.span
              className="ml-0.5 inline-block h-4 w-0.5 align-middle bg-text-secondary"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          ) : null}
        </div>
      </ZedThreadMessage>

      {!isStreaming && isAgent && costUsd !== undefined && costUsd > 0 ? (
        <div className="mt-2 pl-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
          ~${costUsd.toFixed(4)}
        </div>
      ) : null}
    </motion.div>
  );
};

const GlobalChatOverlay: React.FC<GlobalChatOverlayProps> = ({
  isOpen,
  onClose,
  initialQuery = "",
}) => {
  const { t, i18n } = useTranslation();
  const isPortuguese = i18n.language.startsWith("pt");
  const workspaceHint = isPortuguese
    ? "Pesquise reunioes, notas e arquivos locais em um so lugar."
    : "Search meetings, notes, and local files from one place.";
  const localFilesHint = isPortuguese
    ? "Cole um caminho absoluto para abrir modo agente com leitura real."
    : "Paste an absolute path to switch into real file inspection mode.";
  const agentToolsHint = isPortuguese
    ? "Tool calls e acoes do workspace aparecem inline."
    : "Tool calls and workspace actions appear inline.";
  const threadTitle = isPortuguese
    ? "Uma thread para memoria, arquivos e acoes locais"
    : "One thread for memory, files, and local actions";
  const emptyStateTitle = isPortuguese
    ? "Pesquise memoria de reunioes ou inspecione seu workspace real"
    : "Search meeting memory or inspect your real workspace";
  const emptyStateHint = isPortuguese
    ? "Este painel agora funciona como uma thread de agente: respostas em formato de documento, markdown real e leitura de arquivo quando voce compartilha um caminho local."
    : "This panel now behaves like an agent thread: document-style answers, real markdown, and live file reads when you share a local path.";
  const searchIssueTitle = isPortuguese ? "Falha na busca" : "Search issue";
  const searchIssueHint = isPortuguese
    ? "Confira o provider ativo ou o runtime local do agente e tente novamente."
    : "Check the active provider or the local agent runtime and try again.";
  const permissionEyebrow = isPortuguese
    ? "Acao de workspace"
    : "Workspace action";
  const permissionTitle = isPortuguese
    ? "Permitir esta acao?"
    : "Allow this action?";
  const permissionHintPrefix = isPortuguese
    ? "O agente quer usar"
    : "The agent wants to use";
  const denyLabel = isPortuguese ? "Negar" : "Deny";
  const allowLabel = isPortuguese ? "Permitir" : "Allow";
  const meetingsBadge = isPortuguese ? "Reunioes" : "Meetings";
  const workspaceBadge = "Workspace";
  const filesBadge = isPortuguese ? "Arquivos locais" : "Local files";
  const toolsBadge = isPortuguese ? "Agent tools" : "Agent tools";
  const pathFocusedBadge = isPortuguese ? "Arquivo em foco" : "File in focus";
  const pathIdleBadge = isPortuguese ? "Cole um caminho" : "Paste a path";
  const starterLabel = isPortuguese ? "Comece por aqui" : "Start here";
  const localPathLabel = isPortuguese
    ? "Leitura local real"
    : "Real local reads";

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [permissionRequest, setPermissionRequest] =
    useState<AgentPermissionRequest | null>(null);
  const streamBuffer = useStreamBuffer();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const inputHasExplicitPath = hasExplicitLocalPath(query);
  const exampleReadmePath = "C:\\Projects\\Teste\\momor\\README.md";

  const quickPromptCards = [
    {
      key: "meetings",
      icon: Sparkles,
      title: isPortuguese ? "Buscar em reunioes" : "Search meetings",
      hint: isPortuguese
        ? "Cruze resumos, acao items e contexto salvo em uma resposta so."
        : "Blend summaries, action items, and saved context into one answer.",
      meta: meetingsBadge,
      prompt: isPortuguese
        ? "Resuma os temas recorrentes das minhas ultimas reunioes sobre onboarding"
        : "Summarize recurring themes from my latest onboarding meetings",
    },
    {
      key: "files",
      icon: FileSearch,
      title: isPortuguese ? "Inspecionar arquivo real" : "Inspect a real file",
      hint: isPortuguese
        ? "Compartilhe um caminho absoluto para abrir leitura real com tool calls."
        : "Share an absolute path to trigger real file inspection with tool calls.",
      meta: filesBadge,
      prompt: isPortuguese
        ? `Sobre o que fala este arquivo? "${exampleReadmePath}"`
        : `What is this file about? "${exampleReadmePath}"`,
    },
    {
      key: "actions",
      icon: Wrench,
      title: isPortuguese ? "Acao de workspace" : "Workspace action",
      hint: isPortuguese
        ? "Escreva pedidos de criar, editar ou reorganizar arquivos do projeto."
        : "Ask it to create, edit, or reorganize project files.",
      meta: toolsBadge,
      prompt: isPortuguese
        ? `Crie o arquivo "C:\\Projects\\Teste\\momor\\workspace-notes.md" com um checklist curto desta base`
        : `Create the file "C:\\Projects\\Teste\\momor\\workspace-notes.md" with a short checklist for this codebase`,
    },
  ];

  useEffect(() => {
    if (isOpen && initialQuery && messages.length === 0) {
      setTimeout(() => {
        submitQuestion(initialQuery);
      }, 100);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (isOpen && initialQuery && messages.length > 0) {
      submitQuestion(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const cleanup = window.electronAPI?.onAgentPermissionRequest?.((data) => {
      setPermissionRequest(data);
    });

    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPermissionRequest(null);
      void window.electronAPI?.agentCancel?.();
    }
  }, [isOpen]);

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

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const submitQuestion = useCallback(
    async (question: string) => {
      if (
        !question.trim() ||
        chatState === "waiting_for_llm" ||
        chatState === "streaming_response"
      ) {
        return;
      }

      const assistantMessageId = `assistant-${Date.now()}`;
      const isAgentTurn = shouldUseAgentSession(question);
      const listenerCleanups: Array<() => void> = [];
      const addCleanup = (cleanup?: (() => void) | void) => {
        if (typeof cleanup === "function") listenerCleanups.push(cleanup);
      };
      const cleanupStreamListeners = () => {
        while (listenerCleanups.length > 0) {
          listenerCleanups.pop()?.();
        }
      };

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

      try {
        await new Promise((resolve) => setTimeout(resolve, 200));

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            isStreaming: true,
            isAgent: isAgentTurn,
          },
        ]);

        if (isAgentTurn && window.electronAPI?.agentChatStream) {
          streamBuffer.reset();

          addCleanup(
            window.electronAPI.onAgentStreamToken?.((token: string) => {
              setChatState("streaming_response");
              streamBuffer.appendToken(token, (content) => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, content } : msg,
                  ),
                );
              });
            }),
          );

          addCleanup(
            window.electronAPI.onAgentToolCall?.((data) => {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  const existing = msg.toolCalls ?? [];
                  if (existing.some((tool) => tool.toolId === data.toolId)) {
                    return msg;
                  }
                  return {
                    ...msg,
                    isAgent: true,
                    toolCalls: [
                      ...existing,
                      {
                        toolId: data.toolId,
                        name: data.name,
                        args: data.args,
                        status: "running",
                      },
                    ],
                  };
                }),
              );
            }),
          );

          addCleanup(
            window.electronAPI.onAgentToolResult?.((data) => {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  return {
                    ...msg,
                    toolCalls: (msg.toolCalls ?? []).map((tool) =>
                      tool.toolId === data.toolId
                        ? {
                            ...tool,
                            result: data.result,
                            status: data.isError ? "error" : "done",
                          }
                        : tool,
                    ),
                  };
                }),
              );
            }),
          );

          addCleanup(
            window.electronAPI.onAgentStreamDone?.((data) => {
              const finalContent =
                typeof data?.fullText === "string" && data.fullText.trim()
                  ? data.fullText
                  : streamBuffer.getBufferedContent() || "";
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: finalContent,
                        isStreaming: false,
                        isAgent: true,
                        costUsd: data?.costUsd,
                      }
                    : msg,
                ),
              );
              setChatState("idle");
              setPermissionRequest(null);
              setErrorMessage(null);
              streamBuffer.reset();
              cleanupStreamListeners();
            }),
          );

          addCleanup(
            window.electronAPI.onAgentStreamError?.((data) => {
              const friendlyError = humanizeGlobalError(
                data.error,
                isPortuguese,
              );
              setMessages((prev) => {
                let shouldKeepMessage = false;
                const next = prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  shouldKeepMessage =
                    Boolean(msg.content.trim()) ||
                    Boolean(msg.toolCalls?.length);
                  return {
                    ...msg,
                    isStreaming: false,
                    isAgent: true,
                  };
                });
                return shouldKeepMessage
                  ? next
                  : prev.filter((msg) => msg.id !== assistantMessageId);
              });
              setErrorMessage(friendlyError);
              setChatState("error");
              setPermissionRequest(null);
              streamBuffer.reset();
              cleanupStreamListeners();
            }),
          );

          await window.electronAPI.agentChatStream({
            message: question,
            provider: "openclaude",
            meetingTitle: "Global Search",
            systemPrompt: buildGlobalAgentSystemPrompt(
              hasExplicitLocalPath(question),
            ),
          });
          return;
        }

        streamBuffer.reset();

        addCleanup(
          window.electronAPI?.onRAGStreamChunk((data: { chunk: string }) => {
            setChatState("streaming_response");
            streamBuffer.appendToken(data.chunk, (content) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content } : msg,
                ),
              );
            });
          }),
        );

        addCleanup(
          window.electronAPI?.onRAGStreamComplete(() => {
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
            cleanupStreamListeners();
          }),
        );

        addCleanup(
          window.electronAPI?.onRAGStreamError((data: { error: string }) => {
            console.error("[GlobalChat] RAG stream error:", data.error);
            setMessages((prev) =>
              prev.filter((msg) => msg.id !== assistantMessageId),
            );
            setErrorMessage(
              isPortuguese
                ? "Nao foi possivel responder com a busca global. Tente novamente."
                : "Could not answer with global search. Please try again.",
            );
            setChatState("error");
            streamBuffer.reset();
            cleanupStreamListeners();
          }),
        );

        const result = await window.electronAPI?.ragQueryGlobal(question);

        if (result?.fallback) {
          cleanupStreamListeners();
          streamBuffer.reset();

          addCleanup(
            window.electronAPI?.onGeminiStreamToken((token: string) => {
              setChatState("streaming_response");
              streamBuffer.appendToken(token, (content) => {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, content } : msg,
                  ),
                );
              });
            }),
          );

          addCleanup(
            window.electronAPI?.onGeminiStreamDone(() => {
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
              cleanupStreamListeners();
            }),
          );

          addCleanup(
            window.electronAPI?.onGeminiStreamError((error: string) => {
              console.error("[GlobalChat] Gemini stream error:", error);
              setMessages((prev) =>
                prev.filter((msg) => msg.id !== assistantMessageId),
              );
              setErrorMessage(
                isPortuguese
                  ? "Nao foi possivel responder. Confira suas configuracoes e tente de novo."
                  : "Could not get a response. Check your settings and try again.",
              );
              setChatState("error");
              streamBuffer.reset();
              cleanupStreamListeners();
            }),
          );

          await window.electronAPI?.streamGeminiChat(
            question,
            undefined,
            undefined,
            { skipSystemPrompt: false, ignoreKnowledgeMode: true },
          );
        }
      } catch (error) {
        cleanupStreamListeners();
        console.error("[GlobalChat] Error:", error);
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId),
        );
        setErrorMessage(
          isPortuguese
            ? "Algo interrompeu a busca. Tente novamente."
            : "Something interrupted the search. Please try again.",
        );
        setChatState("error");
      }
    },
    [chatState, isPortuguese, streamBuffer],
  );

  return (
    <AnimatePresence
      onExitComplete={() => {
        setChatState("idle");
        setMessages([]);
        setErrorMessage(null);
      }}
    >
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="absolute inset-0 z-40 flex items-end justify-center px-5 pb-0 pt-14"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(8px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 bg-black/30"
          />

          <motion.div
            ref={chatWindowRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "82vh", opacity: 1 }}
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
            className="relative mx-auto mb-0 flex h-[84vh] w-full max-w-[920px] flex-col overflow-hidden rounded-md border border-border-subtle/80 bg-card/96 text-foreground shadow-[0_36px_88px_-48px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 flex-col gap-2 border-b border-border-subtle/80 bg-background/20 px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-text-tertiary">
                    <Search className="h-3.5 w-3.5" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                      {t("globalSearch.title")}
                    </span>
                    <PanelBadge active={inputHasExplicitPath}>
                      {inputHasExplicitPath ? pathFocusedBadge : workspaceBadge}
                    </PanelBadge>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-text-primary">
                    {threadTitle}
                  </p>
                  <p className="mt-1 max-w-[680px] text-[11.5px] leading-5 text-text-secondary">
                    {workspaceHint}
                  </p>
                </div>
                <ZedIconButton
                  icon={<X size={16} />}
                  onClick={onClose}
                  aria-label={t("globalSearch.close")}
                  title={t("globalSearch.close")}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {[meetingsBadge, workspaceBadge, filesBadge, toolsBadge].map(
                  (chip) => (
                    <PanelBadge key={chip}>{chip}</PanelBadge>
                  ),
                )}
                <span className="text-[11px] text-text-tertiary">
                  {inputHasExplicitPath ? localFilesHint : agentToolsHint}
                </span>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="mx-auto max-w-[760px] px-5 py-5 pb-40">
                {messages.length === 0 &&
                chatState === "idle" &&
                !errorMessage ? (
                  <div className="space-y-5 py-2">
                    <div className="border-l border-border-subtle/80 pl-4">
                      <div className="flex items-center gap-2 text-text-tertiary">
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                          {workspaceBadge}
                        </span>
                      </div>
                      <p className="mt-2 text-[14px] font-semibold text-text-primary">
                        {emptyStateTitle}
                      </p>
                      <p className="mt-2 max-w-[660px] text-[12px] leading-6 text-text-secondary">
                        {emptyStateHint}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-text-tertiary">
                        {agentToolsHint}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 px-1">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                          {starterLabel}
                        </span>
                        <div className="h-px flex-1 bg-border-subtle/80" />
                      </div>
                      {quickPromptCards.map((card) => {
                        const Icon = card.icon;
                        return (
                          <ZedListItem
                            key={card.key}
                            onClick={() => setQuery(card.prompt)}
                            spacing="dense"
                            className="px-2 py-2.5 text-left"
                            startSlot={
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border-subtle/80 bg-background/28 text-text-secondary">
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                            }
                            endSlot={<PanelBadge>{card.meta}</PanelBadge>}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                                {card.title}
                              </p>
                              <p className="mt-1 truncate text-[12.5px] font-medium text-text-primary">
                                {card.prompt}
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-text-tertiary">
                                {card.hint}
                              </p>
                            </div>
                          </ZedListItem>
                        );
                      })}
                    </div>

                    <div className="rounded-sm border border-border-subtle/80 bg-background/18 px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                          {localPathLabel}
                        </span>
                        <PanelBadge active>{pathFocusedBadge}</PanelBadge>
                      </div>
                      <p className="mt-2 font-mono text-[11px] leading-5 text-text-primary break-all">
                        {exampleReadmePath}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-text-tertiary">
                        {localFilesHint}
                      </p>
                    </div>
                  </div>
                ) : null}

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

                {chatState === "waiting_for_llm" ? <TypingIndicator /> : null}

                {errorMessage ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-sm border border-border-subtle/80"
                  >
                    <Callout
                      severity="error"
                      borderPosition="none"
                      className="bg-rose-500/[0.06]"
                      title={searchIssueTitle}
                      description={
                        <div className="space-y-1">
                          <p>{errorMessage}</p>
                          <p className="text-[11px] leading-5 text-muted-foreground">
                            {searchIssueHint}
                          </p>
                        </div>
                      }
                    />
                  </motion.div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-50 flex justify-center bg-gradient-to-t from-card via-card/95 to-transparent px-4 pb-4 pt-10">
              <div className="pointer-events-auto w-full max-w-[760px]">
                <ZedComposer
                  value={query}
                  onChange={setQuery}
                  onSubmit={() => {
                    if (query.trim()) {
                      submitQuestion(query);
                      setQuery("");
                    }
                  }}
                  placeholder={t("globalSearch.placeholder")}
                  autoFocus
                  leftSlot={
                    <>
                      <PanelBadge>
                        {meetingsBadge}
                      </PanelBadge>
                      <PanelBadge active={inputHasExplicitPath}>
                        {inputHasExplicitPath
                          ? pathFocusedBadge
                          : pathIdleBadge}
                      </PanelBadge>
                    </>
                  }
                  rightSlot={
                    <span className="hidden md:inline-flex">
                      <PanelBadge>
                      {inputHasExplicitPath ? filesBadge : workspaceBadge}
                      </PanelBadge>
                    </span>
                  }
                />
              </div>
            </div>

            <AnimatePresence>
              {permissionRequest ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-6"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.98, y: 4 }}
                    className="w-full max-w-[420px] rounded-sm border border-border-subtle/80 bg-card/98 p-5 shadow-[0_30px_72px_-40px_rgba(0,0,0,0.9)]"
                  >
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                      {permissionEyebrow}
                    </div>
                    <div className="mt-2 text-[14px] font-semibold text-text-primary">
                      {permissionTitle}
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-text-secondary">
                      {permissionHintPrefix}{" "}
                      <span className="font-mono text-text-primary">
                        {permissionRequest.tool}
                      </span>
                      .
                    </div>
                    {Object.keys(permissionRequest.input || {}).length > 0 ? (
                      <pre className="mt-3 max-h-40 overflow-y-auto rounded-sm border border-border-subtle/80 bg-background/45 px-3 py-2 font-mono text-[11px] text-text-secondary whitespace-pre-wrap">
                        {JSON.stringify(permissionRequest.input, null, 2).slice(
                          0,
                          900,
                        )}
                      </pre>
                    ) : null}
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => respondPermission(false)}
                        className="h-7 rounded-sm px-2.5 text-[11px]"
                      >
                        {denyLabel}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => respondPermission(true)}
                        className="h-7 rounded-sm px-2.5 text-[11px]"
                      >
                        {allowLabel}
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default GlobalChatOverlay;
