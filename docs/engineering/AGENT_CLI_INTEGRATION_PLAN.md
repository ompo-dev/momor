# Plano de Integração de Agentes CLI no Momor (ponta a ponta)

**Data:** 2026-06-10
**Autor:** planejamento técnico
**Escopo:** transformar o Momor em um host de agentes de código (claude-code / openclaude / opencode / codex) que, durante uma reunião, podem **criar, editar e executar arquivos, rodar comandos, usar MCPs e skills** — controlados por chat e por voz, totalmente integrados ao app.

---

## 0. Objetivo do produto

> Eu estou numa reunião conversando com a IA do Momor. Por baixo dos panos, ela está rodando uma CLI agente (claude-code, openclaude, opencode ou codex). Eu posso pedir "cria uma pasta", "escreve um site HTML resumindo a reunião em tal pasta", "edita o arquivo X", "roda esse comando", "usa a skill Y" — e ela realmente faz, com acesso ao meu PC, com o contexto vivo da reunião (transcrição, RAG, tela).

Isso é diferente do modo atual (RAG / chat de pergunta-resposta). É um **modo agente** com acesso a ferramentas reais do sistema operacional.

### 0.1 Dois modos de execução (a escolha do usuário)

Hoje o usuário escolhe **LLM + STT**. Passa a existir um terceiro eixo: o **modo de execução**, escolhido no mesmo lugar (model selector / Settings).

- **Modo A — LLM direta (API ou local):** Gemini, OpenAI/Anthropic via API, DeepSeek, Groq, Ollama/Whisper local. Fluxo `user → LLM → user`. Texto/visão, **sem** ferramentas, skills, MCP ou acesso ao sistema. É o comportamento atual.
- **Modo B — Agente CLI:** claude-code, openclaude, opencode, codex. Fluxo `user → CLI → user`. Por baixo dos panos é **literalmente o CLI do usuário rodando** (equivale a abrir o terminal e digitar `claude`), com skills/plugins/MCPs e acesso real ao PC. O input pode ser voz, texto ou imagem.

Pontos-chave:

- **É opcional.** Se o usuário não quiser CLI, fica só no Modo A (LLM normal). Nada muda para ele.
- **São dois eixos independentes:** "modo de execução" (direta × CLI) **e** "modelo/provedor por baixo". openclaude/opencode podem ser backed por **qualquer** provedor (DeepSeek, OpenAI, local…). O CLI é uma *casca de execução com ferramentas*; o modelo é configurado dentro dele — o Momor passa `--model`, mas a **auth é do próprio CLI** (`claude login`, `codex login`, `opencode auth`), separada das API keys diretas do Momor.
- **A UX adapta-se à capacidade.** Modo A → chat simples (atual). Modo B → tool cards, file-change/diff, aprovações, workspace, skills.
- **Já há precedente no código.** `codex` e `openclaude` **já são `LLMProviderId`** em `electron/llm/ProviderRouter.ts`, e `codex-cli` já é um model selecionável em `LLMHelper` (`isCodexCliModel`, prefixo `codex-cli:`). Hoje o codex roteia para `streamWithCodexCli` (**texto puro, sem ferramentas**) — o Modo B substitui esse caminho pelo `AgentOrchestrator` agêntico completo.
- **Ponto de despacho único.** `LLMHelper.streamChat()`/`_streamChatInner()` (e o `IntelligenceEngine`) passam a **bifurcar**: provider = LLM direta → caminho API atual; provider = agente CLI → `AgentOrchestrator`. Todo input (voz/texto/imagem) entra pelo mesmo roteador.
- **Data-scope continua valendo.** Mandar transcrição/tela para um agente CLI (que repassa ao provedor dele) precisa respeitar `ProviderDataScope` (fail-closed), igual aos providers diretos. Agentes CLI ganham suas próprias políticas de escopo.

---

## 1. Diagnóstico: o que já existe hoje (uncommitted, experimental)

O workspace já contém uma primeira versão da ponte. Mapeamento honesto do estado atual:

| Componente | Arquivo | Estado |
|---|---|---|
| Ponte de agente (spawn + stream) | `electron/services/AgentBridge.ts` | Parcial — só funciona bem para claude/openclaude |
| Servidor MCP de reunião (SSE) | `electron/services/MeetingMCPServer.ts` | Parcial — 1 tool quebrada, config MCP suspeita |
| Handlers IPC `agent-chat-stream` / `agent-cancel` / `agent-get-providers` | `electron/ipcHandlers.ts:5381+` | Funcional, mas one-shot (sem multi-turno) |
| Boot do MCP server | `electron/main.ts:707` | OK (start não-bloqueante na porta 19876) |
| Bridge preload | `electron/preload.ts` | OK |
| Tipos renderer | `src/types/electron.d.ts` | OK |
| UI modo agente (toggle + tool cards) | `src/components/MeetingChatOverlay.tsx:421+` | Parcial — provider hardcoded `openclaude` |
| Codex CLI (legado, robusto) | `electron/services/CodexCliService.ts` | Funcional como provedor LLM, **não** usado pelo bridge |

### 1.1 O que está **quebrado / incompleto** (validado contra o código real)

1. **O agente não consegue de fato mexer em arquivos.** O `AgentBridge` para claude/openclaude **não passa nenhum modo de permissão nem diretório de trabalho**:
   - sem `--permission-mode` nem `--dangerously-skip-permissions` → em modo `--print` não-interativo, o Claude Code/openclaude **bloqueia ou pula** ferramentas de escrita (Write/Edit/Bash) que exigem aprovação;
   - o `spawn()` não define `cwd` → o agente opera no diretório do processo Electron, não numa pasta-alvo. **Não existe o conceito de "workspace"** (a pasta onde ele deve escrever).
   - **Esse é o gap central**: o recurso principal pedido pelo usuário não funciona ainda.

2. **O caminho `opencode` está quebrado.** O `AgentBridge` monta `opencode run --print <prompt> --output-format stream-json`, mas o comando real (`packages/opencode/src/cli/cmd/run.ts`) usa flags **diferentes**:
   - mensagem é **posicional** (não `--print`);
   - é `--format json` (não `--output-format stream-json`);
   - **não existe `--mcp-config`** — no opencode, MCP é configurado via arquivo `opencode.json`, não por flag;
   - o **schema de eventos JSON do opencode é diferente** do Claude (`message.part.updated`, `session.idle`, etc.), e o parser atual (`parseStreamJsonEvent`) só entende o formato do Claude. → não parseia nada.

3. **O caminho `codex` está parcialmente quebrado no bridge.** O branch codex do `AgentBridge.buildArgs` não passa `--sandbox`, e o parser Claude-shaped não entende os eventos do codex (`agent_message`, `turn.completed`, etc.). A lógica correta de extração **já existe** em `CodexCliService` (`findText`/`extractCodexError`) mas **não é reusada** pelo bridge.

4. **Tool `get_screen_context` sempre retorna vazio.** O callback referencia `ScreenContextService.getInstance()?.getLatestOcrText()` — **nenhum desses métodos existe** em `electron/services/screen/ScreenContextService.ts`. A API real de tela é `ScreenUnderstandingService`.

5. **Config MCP provavelmente incompatível.** `getMcpConfigJson()` emite `{ "transport": "sse", "url": ... }`. O Claude Code moderno espera `{ "type": "sse", "url": ... }` (ou `type: "http"`). A chave `transport` pode ser ignorada → tool da reunião não conecta.

6. **`--bare` é suspeito.** Não é flag pública do Claude Code; no bundle aparece apenas como conceito interno de descoberta de skills. Deve ser removida.

7. **Sem continuidade de conversa.** Cada turno é um `spawn` independente (one-shot). Não usa `--resume`/`--continue`/`--session` → o agente "esquece" o turno anterior.

8. **Sem seleção de provider/model/permissão na UI.** O overlay manda `provider: "openclaude"` fixo. Não há Settings para paths dos CLIs, modelo, modo de permissão ou workspace.

9. **Sem entrada por voz.** O usuário quer comandar o agente falando durante a reunião; hoje só há input de texto no overlay.

10. **Sem guardrails de segurança.** Dar acesso a arquivos/comandos a partir de um overlay de reunião é perigoso e ainda não tem allowlist de diretórios, auditoria, kill-switch ou aprovação fina.

---

## 2. Arquitetura-alvo

```
┌──────────────────────────── Renderer (React) ────────────────────────────┐
│  Agent Console (evolução do MeetingChatOverlay)                           │
│  • Seletor: provider · modelo · modo de permissão · workspace             │
│  • Stream de tokens · Tool cards · File-change/diff cards · Command cards  │
│  • Modais de aprovação · custo/tokens · cancelar · continuar conversa      │
└───────────────────────────────── IPC (agent.*) ──────────────────────────┘
                                     │
┌──────────────────────────── Electron Main ───────────────────────────────┐
│  AgentOrchestrator                                                        │
│   • Sessões de agente (multi-turn, 1 por reunião/aba)                      │
│   • Roteia para o Adapter certo · normaliza eventos · aplica políticas     │
│   ├── AgentAdapter (interface comum)                                       │
│   │     ├── ClaudeCodeAdapter   (claude · openclaude)                      │
│   │     ├── OpenCodeAdapter      (opencode)                                │
│   │     └── CodexAdapter         (codex)                                   │
│   ├── WorkspaceManager     (cwd-alvo, criação por reunião, allowlist)      │
│   ├── PermissionEngine     (read-only / auto-edit / full + aprovação)     │
│   ├── McpInjector          (gera mcp-config / escreve opencode.json)      │
│   └── AuditLog             (arquivos tocados, comandos, decisões)         │
└────────────────────────────── Contexto da reunião ───────────────────────┘
        │                                   │
  MeetingMCPServer (SSE :19876)      System prompt enriquecido
   • get_transcript                  (resumo, action items, modo da reunião)
   • query_rag
   • get_screen_context  ← corrigir
   • get_meeting_metadata
   • + save_artifact / list_meeting_files / write tools (novas)
        │
  CLIs externos (claude/openclaude/opencode/codex) → tools nativas:
   Read · Write · Edit · Bash · Glob · Grep · WebFetch · Task · Skill · MCP
```

**Princípio-chave:** todo provider passa por uma **interface única `AgentAdapter`**. O orquestrador fala apenas eventos normalizados (`AgentEvent`); cada adapter sabe traduzir o dialeto do seu CLI (flags + schema de stream + capabilities). Isso conserta a fragilidade atual (lógica do Claude vazando para todos).

---

## 3. Camada de normalização dos providers (a peça central)

### 3.1 Interface `AgentAdapter`

```ts
interface AgentAdapter {
  readonly provider: AgentProvider;
  readonly capabilities: {
    mcpViaFlag: boolean;          // claude=sim, opencode=não (via config), codex=não
    resume: boolean;              // continuidade nativa de sessão
    permissionModes: PermMode[];  // modos suportados
    streamsPartialTokens: boolean;
  };
  // monta o processo a partir das opções unificadas
  buildSpawn(opts: AgentRunOptions, ctx: AdapterContext): {
    cmd: string; args: string[]; stdinPrompt?: string; cwd: string; env: NodeJS.ProcessEnv;
  };
  // injeta o MCP de reunião do jeito do provider (flag OU arquivo de config)
  prepareMcp(ctx: AdapterContext): { args: string[]; cleanup: () => void };
  // traduz UMA linha JSON do CLI em eventos normalizados
  parseLine(json: unknown, state: ParseState): AgentEvent[];
  // extrai o id de sessão para continuidade (--resume)
  extractSessionId?(json: unknown): string | undefined;
}
```

### 3.2 Tabela de normalização (validada contra os CLIs reais)

| Aspecto | **claude / openclaude** | **opencode** | **codex** |
|---|---|---|---|
| Forma de invocar | `--print "<prompt>"` | `run "<message>"` (posicional) | `exec` + prompt no **stdin** |
| Formato de stream | `--output-format stream-json --verbose` | `--format json` | `--json` |
| Schema de eventos | `{type:assistant,message:{content:[text|tool_use]}}`, `{type:result}` | `message.part.updated` / `tool` / `session.idle` | `agent_message` / `turn.*` / item types |
| MCP da reunião | `--mcp-config <file.json>` ✅ | **escrever bloco `mcp` no `opencode.json`** | **não tem MCP no `exec`** → usar tools de reunião via prompt/contexto |
| Modelo | `--model <id>` | `--model provider/model` | `--model <id>` |
| Diretório de trabalho | `cwd` do spawn + `--add-dir <ws>` | `cwd` do spawn + `--dir <ws>` | `cwd` do spawn (`--cd` se disponível) |
| Modo de permissão | `--permission-mode acceptEdits\|plan\|bypassPermissions` ou `--dangerously-skip-permissions` | `--dangerously-skip-permissions` (senão pede aprovação) | `--sandbox read-only\|workspace-write\|danger-full-access` |
| Aprovação fina (UX) | `--permission-prompt-tool mcp__momor__approve` | aprovação interativa não existe em `run` headless → usar skip + allowlist nossa | sandbox decide; sem prompt fino |
| Continuidade | `--resume <sessionId>` (capturar `session_id` do init) | `--session <id>` / `--continue` | `exec` é stateless → manter histórico no prompt ou usar `resume` se houver |
| System prompt | `--append-system-prompt "<s>"` | via `--agent` / config | prefixar no prompt do stdin |
| Streaming token-a-token | `--include-partial-messages` | nativo no `--format json` | nativo no `--json` (deltas) |
| Auth | `claude login` / config openclaude | `opencode auth` | `codex login` / `~/.codex/config.toml` |

### 3.3 Correções concretas por adapter

**ClaudeCodeAdapter** (`claude`, `openclaude`):
- Remover `--bare`.
- Adicionar `--include-partial-messages` (stream mais fluido), `--add-dir <workspace>`, e o modo de permissão (`--permission-mode` conforme a política — ver §4).
- `cwd = workspace`.
- Capturar `session_id` do evento `{type:"system",subtype:"init"}` e usar `--resume <id>` nos turnos seguintes.
- Para aprovação fina: `--permission-prompt-tool` apontando para uma tool MCP nossa que devolve allow/deny vindo de um modal no renderer.

**OpenCodeAdapter** (`opencode`):
- Args corretos: `run "<message>" --format json --model <provider/model> [--agent X] [--continue|--session <id>] [--dir <ws>] [--dangerously-skip-permissions]`.
- MCP: escrever/mesclar bloco `mcp` em `opencode.json` (no workspace ou em `~/.config/opencode/`), apontando para o servidor SSE da reunião:
  ```json
  { "mcp": { "momor-meeting": { "type": "remote", "url": "http://127.0.0.1:19876/sse", "enabled": true } } }
  ```
- Parser novo para os eventos `message.part.updated` (parts `text` e `tool`), `session.idle` (= done), e erros. Referência: `cmd/run.ts` (switch de eventos, ~linhas 440–650).

**CodexAdapter** (`codex`):
- Reusar `CodexCliService.buildArgs` (já adiciona `--sandbox`, `--skip-git-repo-check`, `--model`, `--image`) e a extração `findText`/`extractCodexError`.
- `cwd = workspace`; sandbox mapeado da política de permissão.
- Sem MCP no `exec` → injetar o contexto da reunião direto no prompt (transcrição/resumo/action items) em vez de via tools.
- Emitir tokens conforme os deltas; tratar `turn.failed`/`error` como erro normalizado.

---

## 4. Workspace & permissões (o coração do "mexer em arquivos")

### 4.1 WorkspaceManager
Define **onde** o agente opera (`cwd` do processo). Estratégias (configuráveis):
- **Pasta fixa** (default seguro): ex. `~/Momor/agent-workspace`.
- **Por reunião**: cria `~/Momor/meetings/<slug-da-reuniao>/` no início e usa como cwd → artefatos ficam organizados por reunião (combina com "escreve um site sobre a reunião").
- **Escolher na hora**: dialog nativo de pasta.
- **Allowlist**: o agente só pode escrever dentro do workspace (+ dirs adicionados explicitamente). Bloquear `~`, raízes do sistema, paths sensíveis.

### 4.2 PermissionEngine — modos unificados → flags por provider

| Modo unificado | Significado | claude/openclaude | codex | opencode |
|---|---|---|---|---|
| **read-only** (default seguro) | só lê/analisa, não escreve nem roda comandos destrutivos | `--permission-mode plan` | `--sandbox read-only` | sem skip (nega writes) |
| **auto-edit** (workspace) | escreve/edita **dentro do workspace** sem perguntar; comandos com aprovação | `--permission-mode acceptEdits` + `--add-dir ws` | `--sandbox workspace-write` | `--dir ws` (normal) |
| **full-access** (perigoso) | tudo liberado, qualquer pasta/comando | `--dangerously-skip-permissions` | `--sandbox danger-full-access` | `--dangerously-skip-permissions` |

- **Aprovação fina** (recomendado para auto-edit em comandos): no Claude/openclaude headless, usar `--permission-prompt-tool` → uma tool MCP `momor__approve` que pausa o agente, manda o pedido pro renderer (modal "permitir rodar `npm install`?"), e devolve a decisão. Para opencode/codex (sem prompt fino headless), confiar no sandbox/allowlist e em pré-confirmar a sessão.
- **Confirmação de sessão**: ao iniciar full-access, exigir confirmação explícita do usuário (modal + aviso). Nunca full-access silencioso.

### 4.3 Guardrails
- Allowlist de diretórios + denylist de paths sensíveis.
- Timeout por turno + kill-switch global (botão "parar agente").
- Limpeza de processos órfãos e do `mcp-config` temporário (o `cleanupMcpConfig` atual já ajuda).
- **AuditLog**: registrar cada arquivo criado/editado, cada comando rodado, cada decisão de permissão — exibível na UI e persistível por reunião.

---

## 5. Contexto da reunião + MCP + Skills

### 5.1 Corrigir e expandir o `MeetingMCPServer`
- Corrigir `get_screen_context` para usar a API real (`ScreenUnderstandingService`) em vez dos métodos inexistentes.
- Corrigir o `getMcpConfigJson()` para `{ "type": "sse", "url": ... }` (formato aceito pelo Claude Code).
- **Novas tools de escrita/utilidade** (deixam o agente mais útil sem precisar de Bash):
  - `save_artifact(path, content)` — grava um arquivo no workspace da reunião.
  - `list_meeting_files()` — lista artefatos já gerados.
  - `get_meeting_summary()` / `get_action_items()` — contexto estruturado.

### 5.2 Skills
- claude/openclaude descobrem skills em `~/.claude/skills` e `<workspace>/.claude/skills`.
- opencode tem skills próprias (`SkillTool`, pasta `.opencode`).
- Plano: (a) skills do usuário ficam disponíveis automaticamente; (b) **skills do Momor** plantadas no workspace (ex.: `gerar-ata`, `criar-site-resumo`, `exportar-action-items`) para fluxos de reunião com 1 comando.

### 5.3 MCPs externos plugáveis
- Permitir o usuário registrar outros MCP servers nas Settings; o `McpInjector` mescla com o `momor-meeting` ao gerar o `mcp-config` (claude) ou o `opencode.json` (opencode).

---

## 6. UX no app

### 6.1 Agent Console (evolução do `MeetingChatOverlay`)
- Header com seletores: **provider · modelo · modo de permissão · workspace** (substitui o `provider:"openclaude"` hardcoded).
- Cards: tool calls (já existe) + **file-change/diff cards** (mostra o diff do que o agente escreveu) + **command cards** (comando + saída) + **modais de aprovação**.
- Multi-turno: "continuar conversa" usando `--resume`/`--session`; histórico do agente por reunião.
- Custo/tokens, cancelar, kill-switch.

### 6.2 Settings → nova aba "Agents"
- Paths dos CLIs + **validação** (reusar `CodexCliService.validateExecutable` como padrão para os demais).
- Provider/model default, modo de permissão default, workspace default.
- Toggle de skills e lista de MCPs externos.

---

## 7. Voz → Agente (o diferencial)

- **Intent por voz**: o `IntelligenceEngine` já detecta intenção; adicionar uma intenção "comando ao agente" (gatilhos como "Momor, cria/escreve/edita/roda/usa a skill…"). Ao detectar, roteia a fala para o `AgentOrchestrator`.
- **Alternativa push-to-agent**: um atalho global (`KeybindManager`) que pega a última fala do usuário e envia ao agente — mais previsível que wake-word.
- **Confirmação antes de escrever/rodar**: para ações de escrita, confirmar (voz ou modal) antes de executar, exibindo o que será feito.
- **Resultado**: resumo falado/curto + artefatos no workspace + cards no Agent Console.

---

## 8. Segurança, privacidade e resiliência

- **Data-scope**: o modo agente envia transcrição/contexto a um provider externo. Respeitar o `ProviderRouter`/data-scope (invariante do projeto). Full-access é opt-in e avisa.
- **Sandbox por padrão**: read-only; auto-edit restrito ao workspace; full-access exige confirmação.
- **Auth por provider** documentada (claude/codex login; openclaude config). Não despejar API keys no ambiente do CLI sem necessidade.
- **Auditoria + kill-switch + timeouts + cleanup** (ver §4.3).
- **Testes**: locked invariants no estilo do projeto (normalização de sandbox do codex já é testada — estender para os outros adapters; permissão fail-closed; cleanup de processos).

---

## 9. Roadmap incremental

**Fase 0 — Fazer o experimental funcionar de verdade (escrita real mínima)**
- Adicionar `cwd`/workspace ao spawn + `--permission-mode acceptEdits` + `--add-dir` (claude/openclaude).
- Corrigir config MCP (`type:"sse"`), corrigir `get_screen_context`, remover `--bare`.
- Resultado: dá pra pedir "cria pasta / escreve site HTML" via openclaude e funciona.

**Fase 1 — Workspace + permissões + aprovação**
- `WorkspaceManager` (incl. pasta por reunião) + `PermissionEngine` + aprovação via `--permission-prompt-tool`.
- File-change/diff cards e command cards na UI.

**Fase 2 — Multi-provider robusto**
- Abstração `AgentAdapter`; `OpenCodeAdapter` e `CodexAdapter` completos (flags + parsers corretos).
- Settings "Agents" + continuidade de sessão (`--resume`/`--session`).

**Fase 3 — Skills + MCPs externos + contexto rico**
- Skills do Momor plantadas no workspace; MCPs plugáveis; tools de escrita no `MeetingMCPServer`.

**Fase 4 — Voz → Agente**
- Intent/hotkey, confirmação, fala de resultado.

**Fase 5 — Hardening**
- Auditoria, sandbox, data-scope, testes, telemetria.

---

## 10. Riscos e decisões em aberto

1. **Postura de permissão default**: read-only (seguro) × auto-edit no workspace (útil) × full-access (perigoso). Recomendo **auto-edit restrito ao workspace** como default, full-access opt-in com confirmação.
2. **Provider primário** para amadurecer primeiro: **openclaude** (já é clone do Claude Code, flags compatíveis, MCP via flag) — menor atrito. codex e opencode entram na Fase 2.
3. **Modelo de workspace**: fixo × por-reunião × escolher-na-hora. Recomendo **por-reunião** como default (organiza artefatos), com override.
4. **Aprovação fina headless**: depende do `--permission-prompt-tool` (Claude) — para opencode/codex confiar em sandbox + allowlist.
5. **Empacotamento**: opencode roda em runtime Bun/binário próprio; detecção/validação no app empacotado precisa de cuidado. claude/codex dependem de instalação do usuário (detecção + fallback já existem para codex).
6. **Custo/latência**: agentes são mais lentos/caros que o RAG atual → manter "Agent mode" como toggle explícito (já é assim).

---

## 11. Arquivos a tocar (mapa de implementação)

- `electron/services/AgentBridge.ts` → refatorar para `AgentOrchestrator` + `adapters/` (`ClaudeCodeAdapter`, `OpenCodeAdapter`, `CodexAdapter`).
- `electron/services/MeetingMCPServer.ts` → corrigir config + `get_screen_context` + tools de escrita.
- `electron/services/WorkspaceManager.ts` (novo), `electron/services/PermissionEngine.ts` (novo), `electron/services/AgentAuditLog.ts` (novo).
- `electron/ipcHandlers.ts` → evoluir `agent-chat-stream` para sessões multi-turno + handlers de aprovação/workspace/providers.
- `electron/preload.ts` + `src/types/electron.d.ts` → novos canais (approval, workspace pick, session continue).
- `src/components/MeetingChatOverlay.tsx` → Agent Console (seletores, diff/command cards, aprovação).
- Settings (aba "Agents") + `CredentialsManager`/`SettingsManager` para paths/config.
- `IntelligenceEngine`/`KeybindManager` → intent/hotkey de voz (Fase 4).
- **`electron/LLMHelper.ts` (`streamChat`/`_streamChatInner`) → bifurcação de modo de execução:** provider = agente CLI → delega ao `AgentOrchestrator` (caminho agêntico) em vez do `streamWithCodexCli`/caminho API texto-puro.
- **`electron/llm/ProviderRouter.ts` + registro de modelos + model selector/Settings → expor agentes CLI como categoria de provider** (ao lado das LLMs diretas), com suas próprias políticas de `ProviderDataScope`.
- Testes para normalização de cada adapter e fail-closed de permissão.
