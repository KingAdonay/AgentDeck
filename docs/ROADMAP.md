# AgentDeck Roadmap

Milestone-based. Every task is one commit/PR-sized unit with an explicit acceptance criterion ("done when"). Milestones ship something demoable.

## M0 — Foundation ✅

| #   | Task                                                                                            | Done when                                                           |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0.1 | Scaffold electron-vite (React + TS strict), real package metadata, MIT license                  | `npm run dev` opens a window with HMR                               |
| 0.2 | ESLint (type-aware flat config) + Prettier + Vitest wired                                       | `lint`, `typecheck`, `test`, `format:check` all pass                |
| 0.3 | Security baseline: hardened BrowserWindow, app-wide navigation/webview/permission lockdown, CSP | unit tests assert window options, policy behavior, and CSP presence |
| 0.4 | GitHub Actions CI (format, lint, typecheck, test, build)                                        | green check on GitHub                                               |
| 0.5 | README, CONTRIBUTING, ROADMAP, ARCHITECTURE docs                                                | renders correctly on GitHub                                         |
| 0.6 | Playwright e2e harness (Electron driver) + boot/sandbox/preload smoke tests                     | `npm run test:e2e` green locally and in CI (xvfb)                   |

## M1 — Claude Code adapter (headless core) ✅

The heart of the app; zero UI. Everything here is pure TypeScript tested against fixtures.

| #   | Task                                                                                             | Done when                                                     |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 1.1 | Normalized domain types: `AgentSession`, `AgentEvent`, `SessionStatus`, `AgentAdapter` interface | types compile; short ADR committed in docs/                   |
| 1.2 | Discovery: enumerate `~/.claude/projects`, decode path slugs, list sessions per project          | unit tests pass against a fixture directory tree              |
| 1.3 | Incremental JSONL tailer: byte-offset resume, tolerant of malformed/truncated lines              | fixture tests incl. truncated-line and append-mid-write cases |
| 1.4 | Claude Code entry parser → normalized events (user/assistant messages, tool calls, usage)        | fixture tests from sanitized real transcripts                 |
| 1.5 | Status state machine: `working` / `awaiting-input` / `idle` / `done` from event stream + recency | table-driven unit tests, one per transition                   |
| 1.6 | Watcher service: chokidar + debounce, emits `SessionDelta`s                                      | integration test writes to a temp dir, asserts emitted deltas |

## M2 — Mission Control board (first demoable build) ✅

| #   | Task                                                                            | Done when                                              |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 2.1 | Typed IPC contract, snapshot + delta protocol, preload API                      | contract unit tests; renderer receives a live snapshot |
| 2.2 | Board UI: project groups, session cards (status badge, last activity, duration) | Playwright: fixture home dir → expected cards render   |
| 2.3 | Session detail: virtualized transcript timeline                                 | Playwright: open card → timeline shows fixture events  |
| 2.4 | Empty / onboarding / error states                                               | Playwright: empty fixture dir → onboarding screen      |

## M3 — Live awareness

| #   | Task                                                                                    | Done when                                                   |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 3.1 | Notification engine on status transitions (esp. → awaiting-input), per-rule preferences | unit tests on transition → notification mapping             |
| 3.2 | System tray: aggregate status icon + session quick-list                                 | manual test checklist committed; states screenshot-verified |
| 3.3 | Notification click → focus app, deep-link to session                                    | Playwright deep-link test                                   |
| 3.4 | Settings persistence in `userData` (schema-validated JSON)                              | unit tests for defaults + migration                         |

## M4 — Workspace context

| #   | Task                                                                   | Done when                                |
| --- | ---------------------------------------------------------------------- | ---------------------------------------- |
| 4.1 | Per-session cwd/worktree detection; `git diff --stat` summary on cards | unit tests with a fixture git repo       |
| 4.2 | Token/cost aggregation from usage entries; session + project rollups   | fixture tests match hand-computed totals |
| 4.3 | Board filtering/sorting (status, cost, recency)                        | Playwright filter tests                  |

## M5 — Second agent + public release

| #   | Task                                                                          | Done when                                     |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| 5.1 | Codex CLI adapter (`~/.codex/sessions`) via the same `AgentAdapter` interface | fixture tests; proves the abstraction         |
| 5.2 | electron-builder packaging, icons, release workflow (mac/win/linux)           | tagged release produces installable artifacts |
| 5.3 | README demo GIF, architecture docs, labeled good-first-issues                 | a stranger can contribute unaided             |

## M6 — Interactive control (post-v1, community roadmap)

Launch new sessions into fresh git worktrees (node-pty), respond to approval prompts from the app, session queueing. Deliberately out of v1 scope.
