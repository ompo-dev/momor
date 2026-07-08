import * as fs from "fs";
import * as path from "path";

export type PathAccessTarget = {
  targetPath: string;
  accessDir: string;
};

const MAX_EXPLICIT_PATH_TARGETS = 8;
const MAX_PRELOADED_FILE_TARGETS = 2;
const MAX_PRELOADED_FILE_BYTES = 16_384;
const MAX_PRELOADED_FILE_CHARS = 6_000;
const AGENT_TOOL_REFERENCE_RE =
  /(?:^|\s)(?:\/(?:mcp|mcps|skill|skills)\b|@(?:mcp|mcps|skill|skills)\b)/i;
const AGENT_TOOL_VERB_RE =
  /\b(?:use|run|open|inspect|call|list|usar|rode|rodar|execute|executar|abra|abrir|inspecione|inspecionar|liste|listar)\b[\s\S]{0,48}\b(?:mcp|mcps|skill|skills)\b/i;
const FILE_OPERATION_RE =
  /\b(?:create|edit|delete|remove|rename|move|write|read|open|inspect|summarize|fix|patch|criar|crie|editar|edite|apagar|apague|deletar|delete|excluir|exclua|renomear|renomeie|mover|mova|escrever|escreva|ler|leia|abrir|abra|inspecionar|inspecione|resumir|resuma|corrigir|corrija)\b[\s\S]{0,72}\b(?:file|files|folder|folders|directory|directories|path|paths|workspace|repo|repository|project|codebase|arquivo|arquivos|pasta|pastas|diretorio|diretorios|caminho|caminhos|repositorio|repositorios|projeto|projetos|codigo)\b/i;

function cleanPathCandidate(candidate: string): string {
  return candidate
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[),.;!?]+$/g, "");
}

export function normalizePathKey(candidate: string): string {
  return process.platform === "win32" ? candidate.toLowerCase() : candidate;
}

export function resolvePathAccessTarget(
  candidate: string,
): PathAccessTarget | null {
  const cleaned = cleanPathCandidate(candidate);
  if (!cleaned) return null;
  if (process.platform === "win32" && cleaned.startsWith("/")) return null;

  const normalized = path.normalize(cleaned);
  if (!path.isAbsolute(normalized)) return null;

  try {
    if (fs.existsSync(normalized)) {
      const stat = fs.statSync(normalized);
      return {
        targetPath: normalized,
        accessDir: stat.isDirectory() ? normalized : path.dirname(normalized),
      };
    }

    const parent = path.dirname(normalized);
    if (
      parent &&
      parent !== normalized &&
      fs.existsSync(parent) &&
      fs.statSync(parent).isDirectory()
    ) {
      return {
        targetPath: normalized,
        accessDir: parent,
      };
    }
  } catch {
    // Ignore unreadable candidates and keep the turn alive.
  }

  return null;
}

function isSensitiveReadPath(candidate: string): boolean {
  const lower = candidate.toLowerCase();
  return /[\\/](\.ssh|\.gnupg|\.aws)([\\/]|$)/.test(lower);
}

export function buildPreloadedReferencedFileContext(
  targets: PathAccessTarget[],
): string | undefined {
  const blocks: string[] = [];

  for (const target of targets) {
    if (blocks.length >= MAX_PRELOADED_FILE_TARGETS) break;
    if (isSensitiveReadPath(target.targetPath)) continue;

    try {
      const stat = fs.statSync(target.targetPath);
      if (!stat.isFile()) continue;

      const byteCount = Math.min(stat.size, MAX_PRELOADED_FILE_BYTES);
      const excerptBuffer = Buffer.alloc(byteCount);
      const fd = fs.openSync(target.targetPath, "r");
      const bytesRead = fs.readSync(fd, excerptBuffer, 0, byteCount, 0);
      fs.closeSync(fd);

      const probe = excerptBuffer.subarray(0, Math.min(bytesRead, 512));
      if (probe.includes(0)) continue;

      let excerpt = excerptBuffer
        .subarray(0, bytesRead)
        .toString("utf8")
        .replace(/\r\n/g, "\n");
      if (!excerpt.trim()) continue;

      if (excerpt.length > MAX_PRELOADED_FILE_CHARS) {
        excerpt =
          excerpt.slice(0, MAX_PRELOADED_FILE_CHARS) +
          "\n[truncated after the first local excerpt chunk]";
      }

      blocks.push(
        [
          `Path: ${target.targetPath}`,
          "Host verification: read succeeded before the agent turn.",
          "```text",
          excerpt,
          "```",
        ].join("\n"),
      );
    } catch {
      // Ignore unreadable files and keep the turn alive.
    }
  }

  if (!blocks.length) return undefined;

  return [
    "<preloaded-local-references>",
    "The host preloaded text excerpts from files the user explicitly referenced for this turn.",
    "The host already confirmed these paths were readable for this turn.",
    "Use them as grounded local context. If you need more detail, call Read on the same path.",
    "Do not claim you lack access to these files unless a fresh tool call fails and you report that exact failure.",
    ...blocks,
    "</preloaded-local-references>",
  ].join("\n");
}

export function extractLatestUserTurnText(text?: string): string {
  if (!text) return "";
  const marker = "USER QUESTION:\n";
  const markerIndex = text.lastIndexOf(marker);
  return markerIndex >= 0 ? text.slice(markerIndex + marker.length) : text;
}

export function hasExplicitPathReference(text?: string): boolean {
  return extractPathTargetsFromText(text).length > 0;
}

function normalizeDisclaimerText(text?: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGenericLocalAccessDisclaimer(text?: string): boolean {
  const normalized = normalizeDisclaimerText(text);
  if (!normalized) return false;

  const patterns = [
    /i (?:do not|don't|cant|can't|cannot) have (?:access|permission)/,
    /i am unable to (?:read|open|access)/,
    /without access to (?:that|this) (?:file|path|folder|directory)/,
    /please (?:paste|share) the (?:file|content|contents) here/,
    /nao tenho (?:acesso|permissao)/,
    /nao consigo (?:ler|abrir|acessar)/,
    /sem acesso ao (?:arquivo|caminho|diretorio|conteudo)/,
    /voce pode (?:colar|copiar|enviar) (?:o )?(?:conteudo|arquivo)/,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

/**
 * Mirror the renderer-side "real agent turn" heuristic inside Electron so any
 * legacy chat surface still gets promoted to the OpenClaude-backed tool path.
 */
export function shouldPromoteToAgentTurn(text?: string): boolean {
  if (!text) return false;
  return (
    hasExplicitPathReference(text) ||
    AGENT_TOOL_REFERENCE_RE.test(text) ||
    AGENT_TOOL_VERB_RE.test(text) ||
    FILE_OPERATION_RE.test(text)
  );
}

export function extractPathTargetsFromText(text?: string): PathAccessTarget[] {
  if (!text) return [];

  const patterns: RegExp[] = [
    /["'`]([A-Za-z]:[\\/][^"'`\r\n]+)["'`]/g,
    /(?:^|[\s(])([A-Za-z]:[\\/][^\s"'`<>|]+(?:[\\/][^\s"'`<>|]+)*)/g,
    ...(process.platform === "win32"
      ? []
      : [/["'`](\/[^"'`\r\n]+)["'`]/g, /(?:^|[\s(])(\/[^\s"'`<>|]+)/g]),
  ];

  const targets: PathAccessTarget[] = [];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null) {
      const target = resolvePathAccessTarget(match[1] ?? "");
      if (!target) continue;

      const key = normalizePathKey(target.targetPath);
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(target);
      if (targets.length >= MAX_EXPLICIT_PATH_TARGETS) {
        return targets;
      }
    }
  }

  return targets;
}

export function isSameOrChildPath(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function pickExplicitWorkspaceDir(
  targets: PathAccessTarget[],
): string | undefined {
  if (!targets.length) return undefined;
  const root = targets[0].accessDir;
  const normalizedRoot = normalizePathKey(root);
  return targets.every(
    (target) => normalizePathKey(target.accessDir) === normalizedRoot,
  )
    ? root
    : undefined;
}
