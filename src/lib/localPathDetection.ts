const QUOTED_WINDOWS_PATH_RE = /["'`]([A-Za-z]:[\\/][^"'`\r\n]+)["'`]/;
const BARE_WINDOWS_PATH_RE =
  /(?:^|[\s(])([A-Za-z]:[\\/][^\s"'`<>|]+(?:[\\/][^\s"'`<>|]+)*)/;
const QUOTED_POSIX_PATH_RE = /["'`](\/[^"'`\r\n]+)["'`]/;
const BARE_POSIX_PATH_RE = /(?:^|[\s(])(\/[^\s"'`<>|]+)/;
const AGENT_TOOL_REFERENCE_RE =
  /(?:^|\s)(?:\/(?:mcp|mcps|skill|skills)\b|@(?:mcp|mcps|skill|skills)\b)/i;
const AGENT_TOOL_VERB_RE =
  /\b(?:use|run|open|inspect|call|list|usar|rode|rodar|execute|executar|abra|abrir|inspecione|inspecionar|liste|listar)\b[\s\S]{0,48}\b(?:mcp|mcps|skill|skills)\b/i;
const FILE_OPERATION_RE =
  /\b(?:create|edit|delete|remove|rename|move|write|read|open|inspect|summarize|fix|patch|criar|crie|editar|edite|apagar|apague|deletar|delete|excluir|exclua|renomear|renomeie|mover|mova|escrever|escreva|ler|leia|abrir|abra|inspecionar|inspecione|resumir|resuma|corrigir|corrija)\b[\s\S]{0,72}\b(?:file|files|folder|folders|directory|directories|path|paths|workspace|repo|repository|project|codebase|arquivo|arquivos|pasta|pastas|diretorio|diretorios|caminho|caminhos|repositorio|repositorios|projeto|projetos|codigo)\b/i;

export function hasExplicitLocalPath(text: string): boolean {
  if (!text) return false;
  return (
    QUOTED_WINDOWS_PATH_RE.test(text) ||
    BARE_WINDOWS_PATH_RE.test(text) ||
    QUOTED_POSIX_PATH_RE.test(text) ||
    BARE_POSIX_PATH_RE.test(text)
  );
}

/**
 * Returns true when the user is asking for a real agent turn instead of a
 * pure search/LLM answer. This keeps search-mode UX for normal questions while
 * auto-promoting file, skill, and MCP tasks to the OpenClaude-backed agent.
 */
export function shouldUseAgentSession(text: string): boolean {
  if (!text) return false;
  return (
    hasExplicitLocalPath(text) ||
    AGENT_TOOL_REFERENCE_RE.test(text) ||
    AGENT_TOOL_VERB_RE.test(text) ||
    FILE_OPERATION_RE.test(text)
  );
}
