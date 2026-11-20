# Architecture

## Process model

Electron gives us three isolation domains; AgentDeck uses them strictly:

- **Main process** — the only privileged code. Owns filesystem watching, transcript parsing, git subprocesses, notifications, tray, and settings. Organized as:
  - `agents/` — the adapter layer. An `AgentAdapter` discovers sessions and turns agent-specific transcript entries into normalized `AgentEvent`s. **Pure TypeScript, zero Electron imports**, fixture-tested.
  - `sessions/` — `SessionStore` reduces `AgentEvent`s into `SessionState`; contains the status state machine (`working | awaiting-input | idle | done`).
  - `history/` — durable task history in SQLite (see below).
  - `watchers/` — chokidar watching + byte-offset JSONL tailing so a 50 MB transcript is never re-read.
  - `ipc/` — typed IPC router.
  - `window.ts` / `security.ts` — window options and app-wide hardening as pure, unit-testable functions.
- **Preload** — a minimal `contextBridge` API (`window.api`). Capabilities are added one at a time; `ipcRenderer` is never exposed wholesale.
- **Renderer** — sandboxed React SPA with no Node access. A Zustand store hydrates from an IPC snapshot and applies `session-updated` deltas.

## Data flow

```
transcript JSONL ──(chokidar)──▶ tailer ──▶ adapter.parse ──▶ AgentEvent
    AgentEvent ──▶ SessionStore.reduce ──▶ SessionState (+ delta)
    delta ──(webContents.send)──▶ preload bridge ──▶ Zustand store ──▶ UI
```

The main process is the single source of truth. The renderer can always be rebuilt from `getSnapshot()` — this makes HMR, reconnects, and multi-window trivial.

## Task history

Agents delete their own transcripts (Claude Code on re-login and after its retention window; Codex similarly), which would erase finished tasks from the board. `history/` keeps a durable, **metadata-only** record of every session AgentDeck has seen:

- **Stored** (`tasks` table): agent, session id, project path, branch, AI title, a highlight (the first prompt, whitespace-collapsed and capped at 200 chars), model, start/last-activity time, prompt and tool-call counts, token usage, and lines added/removed + files changed by the agent's own edits.
- **Never stored**: transcript content — no replies, tool inputs or outputs, file contents, or diffs.
- **Where**: `history.sqlite` in Electron's `userData` directory (e.g. `~/Library/Application Support/AgentDeck/` on macOS); delete the file to clear history. `AGENTDECK_HISTORY_DB` overrides the path (e2e tests use a temp file).
- **How**: `HistoryRecorder` subscribes to `SessionService` updates and upserts the latest state per session every 5s (and on quit). The startup replay backfills any transcript still on disk. Rows are never deleted when a transcript disappears, and an upsert never replaces a row with older `last_activity_at`.
- **Engine**: Node's built-in `node:sqlite` (Electron 43 / Node 24) — no native addon, so packaging stays `out/**` only. Schema migrations run off `PRAGMA user_version`.

Lines changed come from the transcripts themselves: Claude Code's Edit/Write results carry a `structuredPatch`; Codex's `apply_patch` calls carry the patch text. Edits made through shell commands (`sed`, heredocs) aren't visible this way and aren't counted.

## Why read transcripts instead of wrapping agent CLIs?

Wrapping (spawning agents inside our own PTY) requires users to change how they launch agents, breaks when CLIs update their flags, and can't see sessions started elsewhere. Transcripts are the agents' own durable record: reading them is zero-friction (works with sessions the user started in any terminal), read-only (we can't corrupt a session), and versionable via fixtures. Interactive control (M6) will add opt-in PTY launching _on top of_ passive observation, not instead of it.

## Security posture

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` on every window (unit-tested).
- App-wide `web-contents-created` policy: external navigation blocked, `<webview>` denied, all permission requests refused (unit-tested).
- CSP on the renderer document (regression-tested).
- External links open via `shell.openExternal`, never in-app.
- No remote content, no auto-update code paths until signed releases exist.

## Testing strategy

| Layer                             | Tool                  | Approach                                                                           |
| --------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| Adapters, parsers, status machine | Vitest                | fixture directories with sanitized real transcripts; table-driven transition tests |
| Watcher                           | Vitest                | temp dirs, real fs events                                                          |
| IPC contract                      | Vitest                | typed contract tests on both sides                                                 |
| UI flows                          | Playwright (Electron) | app booted against a fixture `AGENTDECK_HOME`, asserting rendered board state      |
