# Contributing to AgentDeck

Thanks for your interest! This project is deliberately structured so that contributions stay small and safe.

## Ground rules

- **Every task on the [roadmap](docs/ROADMAP.md) is commit-sized and has an explicit acceptance test.** PRs should map to one task (or one focused fix).
- **The agent adapter layer (`src/main/agents`, `src/main/sessions`) must stay pure TypeScript** — no Electron imports. It is tested with Vitest against fixture directories in `src/main/agents/__fixtures__`.
- **Never weaken the security baseline** (`src/main/window.ts`, `src/main/security.ts`). The unit tests around it are load-bearing; a PR that touches them will get extra scrutiny.
- All privileged operations live in the main process behind a typed IPC channel. The renderer never gets raw `ipcRenderer` or Node access.

## Adding support for a new agent

The most valuable contribution: implement the `AgentAdapter` interface for your agent CLI (Gemini CLI, opencode, Cursor, ...):

1. Add fixture transcripts under `src/main/agents/__fixtures__/<agent>/` (sanitize any real data!).
2. Implement discovery + parsing to the normalized `AgentEvent` model.
3. Table-driven tests for the status transitions your agent supports.

## Workflow

```bash
npm install
npm run dev          # run the app with HMR
npm test             # Vitest unit tests
npm run lint && npm run typecheck && npm run format:check
```

CI runs format-check, lint, typecheck, tests, and a production build on every PR — all five must be green.

## Commit style

Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `test:`). Keep the subject imperative and under ~70 chars.
