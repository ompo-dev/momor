# Momor Current System Spec

**Date:** 2026-06-09  
**Scope:** current workspace behavior, derived from code, tests, and shipped docs  
**Purpose:** establish a spec baseline that future work can change intentionally rather than implicitly

---

## 1. Spec posture

This document is **descriptive first** and **prescriptive second**.

- Descriptive: it records what the current project actually does today.
- Prescriptive: it defines the behavior that new changes should preserve unless deliberately revised.

When code, tests, and docs disagree, the intended order of truth for this
baseline is:

1. Runtime code paths currently wired into the app
2. Tests that assert or lock important behavior
3. Existing engineering reports in `docs/engineering`
4. Older or legacy code paths that remain on disk but are not part of the default runtime flow

This workspace currently contains uncommitted meeting-agent changes in the
Electron and renderer layers. Because those paths are already wired into IPC
and UI, this spec treats them as **current experimental behavior** rather than
ignoring them.

## 2. Product definition

Momor is a desktop meeting assistant built with Electron, React, and native
audio capture. Its core job is to:

- capture system audio and microphone audio during a live meeting
- transcribe both channels with low latency
- maintain rolling conversational context
- generate on-demand coaching and response suggestions
- persist useful meeting history and searchable knowledge when retention allows it
- keep the experience discreet through overlay, stealth, tray, and disguise behaviors

The product is not only a transcript viewer. It is a **real-time assistance
system** with post-call memory, mode-specific prompting, optional screen
understanding, and increasingly agent-style workflows.

## 3. User-facing surfaces

The current application exposes five primary renderer surfaces:

- **Launcher window:** the home/dashboard surface for starting meetings, reviewing history, opening settings, and accessing global chat.
- **Overlay window:** the live meeting assistant surface with transcript, quick actions, manual prompts, screenshots, and stealth controls.
- **Settings window/overlay:** the main control plane for providers, privacy, behavior, modes, keybinds, phone mirror, language, and help.
- **Model selector window:** a compact picker for runtime model changes.
- **Cropper window:** a screenshot selection/capture helper used by screen-aware flows.

The default product mental model is:

1. configure providers and privacy
2. start a meeting
3. receive live transcript and contextual assistance
4. stop the meeting
5. review saved notes, summary, transcript, and RAG-backed follow-up value later

## 4. Runtime architecture

### 4.1 Main layers

The system is split into four cooperating layers:

- **Renderer:** React/Vite UI for launcher, overlay, settings, history, and meeting chat
- **Electron main process:** app lifecycle, windowing, IPC, permissions, orchestration, native integration, persistence wiring
- **Service layer:** intelligence, providers, RAG, settings, credentials, phone mirror, calendar, screen understanding, modes, telemetry
- **Native layer:** Rust NAPI module for low-level system audio and microphone capture, plus platform-specific stealth helpers

### 4.2 Main orchestrator

`electron/main.ts` acts as the runtime coordinator. It is responsible for:

- bootstrapping managers and helpers
- creating and hiding/showing windows
- managing tray and disguise behavior
- handling permissions and lifecycle cleanup
- starting and stopping meetings
- recovering after sleep or partial shutdown conditions
- keeping the app usable in both visible and undetectable modes

### 4.3 Renderer contract

Renderer code talks to the main process through a large typed preload bridge
exposed on `window.electronAPI`. The IPC contract is broad by design and
includes:

- meeting lifecycle
- intelligence actions
- provider and settings management
- history and RAG operations
- screenshot and screen-understanding flows
- phone mirror
- calendar integration
- experimental agent chat streaming

## 5. Primary system behaviors

### 5.1 App startup

On boot, the app must:

- initialize theme state before UI paint to avoid theme flash
- initialize settings and encrypted credentials stores
- prepare logging with redaction support
- create the launcher surface
- preload or lazily initialize heavy services as needed
- restore persistent settings such as undetectable mode, provider scopes, retention, and selected models

The app may also initialize tray behavior, phone mirror services, calendar
support, and local model helpers depending on configuration and platform.

### 5.2 Meeting lifecycle

Starting a meeting must create a live session that binds together:

- audio capture
- speech-to-text
- rolling transcript/session context
- live overlay rendering
- intelligence actions
- optional screen-aware and agent-assisted features

Ending a meeting must:

- stop capture safely
- flush pending transcript buffers
- preserve final STT output before teardown
- decide whether the session should be persisted
- store a placeholder meeting record if persistence is allowed
- perform summary/title generation asynchronously
- emit history updates back to the renderer

Short sessions and `doNotPersist` or retention-blocked sessions must not be
treated as normal saved history.

### 5.3 Live transcript behavior

The transcript model is not a simple append-only log. The session layer tracks:

- separate user and interviewer/system turns
- interim and final transcript segments
- rolling recent context for low-latency prompts
- longer full-session transcript for persistence and RAG
- periodic summarization/compaction of older context
- active listening state
- coding-question hints derived from transcript or screenshots

The system currently keeps a bounded rolling context window for fast prompting
while preserving a fuller transcript artifact for post-call use.

### 5.4 Real-time intelligence actions

The assistant supports multiple response modes rather than one generic chat
path. Current first-class actions include:

- `what_to_say`
- `follow_up`
- `follow_up_questions`
- `clarify`
- `recap`
- `brainstorm`
- `manual`
- `code_hint`
- general assist/chat flows

These actions are driven by the `IntelligenceEngine`, which combines:

- mode-specific prompt assembly
- language and refinement-intent handling
- dynamic action context
- speculative triggering for some partial interviewer input
- provider/model routing through the LLM layer

The product requirement here is responsiveness: the system should be able to
generate targeted assistance off the current meeting context without forcing
the user into a full long-form chat every time.

### 5.5 Dynamic actions

The overlay supports dynamic, context-sensitive action buttons. The current
code and tests require that when a dynamic action supplies a
`promptInstruction`, that instruction is preserved all the way into the
`what_to_say` generation path. This is a behavioral invariant, not a UI nicety.

### 5.6 Modes and prompt specialization

Modes are a core product primitive. A mode is not just a label; it is a bundle
of:

- a system-prompt specialization
- note sections
- optional reference files
- retrieval context
- meeting-summary-safe context blocks

The current product ships seven canonical templates:

- general
- sales
- recruiting
- team-meet
- looking-for-work
- technical-interview
- lecture

The system must always ensure a usable General/default mode exists. Mode
context must remain isolated so prompt material from one mode does not bleed
into another unless explicitly intended.

### 5.7 Screen understanding

The default screen-understanding path is now **vision-first**, not traditional
OCR-first.

Current runtime requirements:

- image input may come from existing paths or fresh capture
- image paths must be validated before use
- the system should hash/cache work when possible
- provider selection must respect privacy/data-scope constraints
- a fallback chain should try compatible vision providers in priority order
- the first meaningful structured result should win

The output is structured screen context rather than raw OCR text alone. The
result may include:

- screen type
- visible summary
- extracted text
- code blocks
- tables
- task detection
- provider attempt metadata
- compatibility fields for older consumers

Supported behavior modes currently include:

- `vision_first`
- `vision_only`
- `private_vision`

Legacy OCR-related modules still exist on disk, but they are not the current
default product path and should not be treated as the primary specification.

### 5.8 Retrieval and post-meeting memory

Meeting memory is backed by SQLite plus vector indexing via `sqlite-vec`.

The current RAG system is responsible for:

- transcript preprocessing and chunking
- embedding generation and queueing
- per-meeting and broader retrieval
- live or near-live indexing support
- post-call question answering over saved meeting memory
- reprocessing or reindexing incompatible embeddings when needed

Retrieval must honor provider data-scope restrictions. A provider that is not
allowed to receive certain data classes must be blocked from those operations.

### 5.9 Persistence and retention

Meeting persistence is conditional, not automatic.

The current system must respect:

- app-level retention settings: `forever`, `7d`, `30d`, `never`
- per-session `doNotPersist` semantics
- post-crash recovery for meetings left in processing states
- sanitized telemetry when persistence is skipped

When persistence is allowed, the system stores:

- meeting metadata
- transcript
- summary/title artifacts
- AI interaction artifacts
- chunks and chunk summaries
- embeddings/indexing state
- mode and note context references

### 5.10 Privacy and provider scope enforcement

Privacy controls are a product-level feature, not a hidden implementation
detail.

The system currently exposes and enforces:

- encrypted credential storage via Electron `safeStorage`
- plain settings storage separated from secrets
- provider data-scope controls
- local/private screen-understanding mode
- local model options such as Ollama and local Whisper paths
- retention controls including no-persistence mode

Provider routing must fail closed when a provider is not allowed to see a data
class required by a request.

### 5.11 Phone mirror

Momor can expose a phone-friendly companion surface over a local HTTP/WebSocket
service. The current service is expected to:

- choose an available port
- generate a tokenized session URL and QR path
- stream user-visible assistant deltas and completion states
- retain recent mirrored history for reconnect scenarios

This is a convenience and continuity feature rather than the primary meeting
surface.

### 5.12 Calendar integration

The project includes Google Calendar support through an OAuth flow that depends
on a backend base URL. In the current open workspace, the feature is partially
wired but environment-dependent. The spec status is:

- supported by architecture
- not guaranteed active in an unconfigured build

Calendar flows should therefore be treated as **conditional capability** rather
than guaranteed baseline behavior.

### 5.13 Experimental agent bridge

The current workspace includes an experimental meeting-agent path that combines:

- a local MCP server exposing meeting tools
- an agent bridge that can spawn external CLIs such as Codex/OpenClaude-style agents
- IPC streaming for tool calls, text deltas, completion, and cancellation
- renderer support in the meeting chat overlay

This path is already integrated enough to be part of the current system
surface, but it should be treated as **experimental** because it is present in
uncommitted workspace changes and appears newer than the rest of the product.

The behavioral contract appears to be:

- agents can read transcript and meeting metadata through MCP tools
- agents can query saved/live meeting context and screen context
- the UI can surface streaming text plus tool-call cards
- users can cancel active agent runs

## 6. Data model baseline

The local database is a SQLite store in the user data directory and includes
application, meeting, and retrieval tables. The current baseline schema
supports at least:

- meetings
- transcripts
- AI interactions
- chunked retrieval artifacts
- embedding queues
- user profile data
- resume nodes
- modes
- mode reference files
- mode note sections
- app state

The product assumes this database can support both:

- fast operational reads for recent history
- slower background enrichment such as summaries and retrieval indexing

## 7. Non-functional requirements

The current codebase implies the following non-functional requirements:

### 7.1 Latency

- live meeting suggestions should feel immediate enough to be useful in-call
- STT shutdown must preserve final buffered output rather than dropping it for speed
- screenshot/screen-understanding work should use fallback and caching rather than blocking indefinitely

### 7.2 Resilience

- the app should survive partial provider failures through routing/fallback where possible
- meetings left in processing states should be recoverable
- sleep/wake and shutdown sequences need explicit teardown handling

### 7.3 Discretion

- overlay and launcher behavior must support stealth use cases
- disguise modes and mouse passthrough are first-class product constraints
- tray-based or hidden operation matters to the experience

### 7.4 Safety and privacy

- secrets must not be stored in plain settings files
- provider data-scope policy must be enforceable at runtime
- private/local-only paths must exist for users with stronger privacy needs

## 8. Test-backed invariants

The current automated tests establish several behaviors that should be treated
as locked unless intentionally changed:

- exactly seven production mode templates are expected
- General mode must exist and mode context isolation matters
- dynamic action `promptInstruction` must flow into generation
- provider data-scope checks must gate routing and embeddings
- Codex CLI provider config must normalize sandbox and path behavior correctly
- local Whisper stop/flush behavior must preserve pending final transcript output
- retention and `doNotPersist` semantics must block normal persistence paths
- hybrid retrieval behavior and related telemetry hooks must remain wired

Some older OCR-oriented tests are explicitly skipped because they no longer
match the vision-first runtime path. That means legacy OCR behavior should not
be used as the governing spec without a deliberate rollback decision.

## 9. Current boundaries and known gaps

This baseline also captures what the system is **not** promising yet:

- not every documented integration is guaranteed active without environment setup
- the meeting-agent bridge is real in this workspace, but not yet mature enough to treat as stable platform surface
- legacy OCR code presence does not imply default OCR behavior
- some engineering docs describe transitional states and should be read as historical context, not always current truth

## 10. Change policy from this baseline

Future changes should be evaluated against this document using three questions:

1. Does the change alter a core product behavior or only implementation details?
2. If it alters behavior, which section of this spec is being changed on purpose?
3. Is there a test, migration, or doc update that makes the new behavior explicit?

If a future change affects meeting persistence, provider privacy, transcript
integrity, mode isolation, or the live assistance contract, it should be
treated as a spec change, not a refactor.

## 11. Concise product spec

In one sentence:

> Momor is a discreet desktop meeting copilot that captures live conversation,
> turns it into low-latency contextual assistance, and optionally preserves that
> knowledge for later retrieval under strict provider, privacy, and retention
> controls.

In one paragraph:

Momor should let a user enter a meeting, receive fast and mode-aware help from
live transcript plus optional screen context, remain in control of where data
can go, and leave the meeting with useful memory artifacts when retention
permits. The app succeeds when it is fast enough to help in real time,
structured enough to produce targeted coaching instead of generic chat, private
enough to satisfy local-first or scoped-provider use cases, and resilient
enough to preserve the important parts of a meeting without requiring the user
to think about system internals.
