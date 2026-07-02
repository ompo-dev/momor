import React, { useState } from "react";
import { Trash2, Plug, Save, Braces } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { useMcpServers, useAbilityActions, type McpServer } from "./useAbilities";

interface McpEditorProps {
  id: string;
  onDeleted: () => void;
}

type McpFields = {
  name?: string;
  transport: "stdio" | "sse" | "http";
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
};

/** Map a single MCP server entry (claude/cursor format) into our fields. */
function entryToFields(entry: any): Omit<McpFields, "name"> {
  if (!entry || typeof entry !== "object") throw new Error("invalid entry");
  if (entry.url) {
    return {
      transport: entry.type === "http" ? "http" : "sse",
      command: null,
      args: [],
      env: {},
      url: String(entry.url),
    };
  }
  return {
    transport: "stdio",
    command: entry.command ? String(entry.command) : null,
    args: Array.isArray(entry.args) ? entry.args.map(String) : [],
    env:
      entry.env && typeof entry.env === "object"
        ? (entry.env as Record<string, string>)
        : {},
    url: null,
  };
}

/**
 * Accept the JSON formats people copy from MCP docs:
 *   { "mcpServers": { "name": { ...entry } } }   (Claude Desktop / Cursor)
 *   { "name": { ...entry } }                      (map of one)
 *   { "command": ..., "args": [...] }             (a bare entry)
 */
export function parseMcpJson(text: string): McpFields {
  const obj = JSON.parse(text);
  if (obj && obj.mcpServers && typeof obj.mcpServers === "object") {
    const keys = Object.keys(obj.mcpServers);
    if (!keys.length) throw new Error("mcpServers is empty");
    return { name: keys[0], ...entryToFields(obj.mcpServers[keys[0]]) };
  }
  if (obj && (obj.command || obj.url || obj.type || obj.args)) {
    return { ...entryToFields(obj) };
  }
  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length) return { name: keys[0], ...entryToFields(obj[keys[0]]) };
  }
  throw new Error("unrecognized MCP JSON");
}

/** Build the displayable JSON ({ mcpServers: { name: entry } }) from fields. */
function fieldsToJson(f: {
  name: string;
  transport: "stdio" | "sse" | "http";
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
}): string {
  const entry =
    f.transport === "stdio"
      ? {
          command: f.command || "",
          ...(f.args.length ? { args: f.args } : {}),
          ...(Object.keys(f.env).length ? { env: f.env } : {}),
        }
      : { type: f.transport, url: f.url || "" };
  return JSON.stringify({ mcpServers: { [f.name || "server"]: entry } }, null, 2);
}

const McpEditor: React.FC<McpEditorProps> = ({ id, onDeleted }) => {
  const { t } = useTranslation();
  const { data: servers, isLoading } = useMcpServers();
  const server = servers?.find((s) => s.id === id);

  if (isLoading || !server) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        {t("workspace.loading")}
      </div>
    );
  }
  return <McpForm key={id} server={server} onDeleted={onDeleted} />;
};

const McpForm: React.FC<{ server: McpServer; onDeleted: () => void }> = ({
  server,
  onDeleted,
}) => {
  const { t } = useTranslation();
  const { invalidateMcps } = useAbilityActions();
  const [name, setName] = useState(server.name);
  const [transport, setTransport] = useState(server.transport);
  const [command, setCommand] = useState(server.command ?? "");
  const [argsText, setArgsText] = useState((server.args ?? []).join(" "));
  const [envText, setEnvText] = useState(
    Object.entries(server.env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  );
  const [url, setUrl] = useState(server.url ?? "");
  const [enabled, setEnabled] = useState(server.enabled);
  const [saved, setSaved] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const parseEnv = (text: string): Record<string, string> => {
    const env: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return env;
  };

  const argsArr = () => (argsText.trim() ? argsText.trim().split(/\s+/) : []);

  const toggleJson = () => {
    if (!jsonMode) {
      setJsonText(
        fieldsToJson({
          name,
          transport,
          command,
          args: argsArr(),
          env: parseEnv(envText),
          url,
        }),
      );
      setJsonError(null);
    }
    setJsonMode((m) => !m);
  };

  const save = async () => {
    let eff = {
      name: name.trim() || "mcp",
      transport,
      command: command.trim() || null,
      args: argsArr(),
      env: parseEnv(envText),
      url: url.trim() || null,
    };

    if (jsonMode) {
      try {
        const p = parseMcpJson(jsonText);
        eff = {
          name: (p.name ?? name).trim() || "mcp",
          transport: p.transport,
          command: p.command?.trim() || null,
          args: p.args,
          env: p.env,
          url: p.url?.trim() || null,
        };
        // Reflect parsed values back into the form so switching views is consistent.
        setName(eff.name);
        setTransport(eff.transport);
        setCommand(eff.command ?? "");
        setArgsText(eff.args.join(" "));
        setEnvText(
          Object.entries(eff.env)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n"),
        );
        setUrl(eff.url ?? "");
        setJsonError(null);
      } catch (e: any) {
        setJsonError(e?.message || "Invalid JSON");
        return;
      }
    }

    await window.electronAPI.mcpUpdate(server.id, { ...eff, enabled });
    invalidateMcps();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const remove = async () => {
    await window.electronAPI.mcpDelete(server.id);
    invalidateMcps();
    onDeleted();
  };

  const field =
    "w-full bg-bg-input border border-border rounded-md px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/50";
  const label = "text-[12px] font-medium text-text-secondary mb-1 block";

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-2xl mx-auto px-10 py-10 space-y-5">
        <div className="flex items-center gap-3">
          <Plug size={22} className="text-text-secondary" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="filesystem"
            className="flex-1 bg-transparent text-2xl font-bold text-text-primary placeholder:text-text-tertiary outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-secondary">
              {enabled ? t("workspace.enabled") : t("workspace.disabled")}
            </span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div
          className={`rounded-md border px-3 py-2 text-[12px] ${
            server.source === "openclaude"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {server.source === "openclaude"
            ? "This MCP server is synced and will be available in the next agentic chat."
            : "This is a local Momor draft. Fill in a valid command or URL and save to publish it for agentic chats."}
        </div>

        <div className="flex items-center justify-between">
          <label className={`${label} mb-0`}>{t("workspace.transport")}</label>
          <button
            type="button"
            onClick={toggleJson}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] border ${
              jsonMode
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-text-secondary hover:bg-accent/40"
            }`}
          >
            <Braces size={13} />
            {jsonMode ? t("workspace.editAsForm") : t("workspace.editAsJson")}
          </button>
        </div>

        {jsonMode ? (
          <div>
            <p className="mb-1 text-[11px] text-text-tertiary">
              {t("workspace.mcpJsonHint")}
            </p>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              spellCheck={false}
              className={`${field} font-mono resize-y`}
              placeholder={
                '{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]\n    }\n  }\n}'
              }
            />
            {jsonError && (
              <p className="mt-1 text-[11px] text-destructive">{jsonError}</p>
            )}
          </div>
        ) : (
          <>
        <div>
          <div className="flex gap-2">
            {(["stdio", "sse", "http"] as const).map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => setTransport(tr)}
                className={`px-3 py-1.5 rounded-md text-[12px] border ${
                  transport === tr
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-text-secondary hover:bg-accent/40"
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>

        {transport === "stdio" ? (
          <>
            <div>
              <label className={label}>{t("workspace.command")}</label>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx"
                className={field}
              />
            </div>
            <div>
              <label className={label}>{t("workspace.args")}</label>
              <input
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-filesystem /path"
                className={field}
              />
            </div>
            <div>
              <label className={label}>{t("workspace.envVars")}</label>
              <textarea
                value={envText}
                onChange={(e) => setEnvText(e.target.value)}
                placeholder={"API_KEY=...\nFOO=bar"}
                rows={3}
                className={`${field} font-mono resize-y`}
              />
            </div>
          </>
        ) : (
          <div>
            <label className={label}>URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/sse"
              className={field}
            />
          </div>
        )}
          </>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive">
            <Trash2 size={14} className="mr-1.5" />
            {t("workspace.delete")}
          </Button>
          <Button size="sm" onClick={save} className="gap-1.5">
            <Save size={14} />
            {saved ? t("workspace.saved") : t("workspace.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default McpEditor;
