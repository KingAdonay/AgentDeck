# AgentDeck

**Mission control for your coding agents.** Monitor every Claude Code and Codex CLI session on your machine from one window — see who's working, who's blocked waiting for your input, and who's done.

> ⚠️ Early development. The [roadmap](docs/ROADMAP.md) is public and contributions are welcome.

## Why

The way we build software changed: one developer now supervises several coding agents running in parallel — Claude Code in two git worktrees, Codex CLI on a refactor, another session reviewing a PR. What didn't change is the tooling: that fleet lives in a pile of terminal tabs, and the human has become a scheduler with no scheduler UI.

You don't know which agent is blocked on an approval prompt, which finished twenty minutes ago, and which is quietly burning tokens down a rabbit hole. AgentDeck makes the fleet visible.

## What it does

- **Discovers sessions automatically** by reading the transcripts agents already write to disk (`~/.claude/projects`, `~/.codex/sessions`) — no wrappers, no shims, your workflow doesn't change.
- **Live status board**: every session grouped by project, with derived status — `working`, `awaiting input`, `idle`, `done`.
- **Native notifications** the moment an agent needs you.
- **Session detail**: a timeline of messages, tool calls, and costs.
- **Workspace context**: per-session git diff stats and token/cost rollups. _(planned — see roadmap)_

## Architecture

```
┌────────────────────── Main process (privileged) ──────────────────────┐
│  agents/         AgentAdapter interface + per-agent implementations   │
│  sessions/       SessionStore: events → SessionState (status machine) │
│  watchers/       chokidar + byte-offset JSONL tailing                 │
│  ipc/            typed IPC router (snapshot + delta protocol)         │
└──────────────┬────────────────────────────────────────────────────────┘
               │  contextBridge: minimal typed `window.api`
┌──────────────┴────────── Renderer (sandboxed, zero Node) ─────────────┐
│  React + Zustand · board view · session timeline                      │
└────────────────────────────────────────────────────────────────────────┘
```

Design rules that keep this codebase contributable:

1. **The agent adapter layer is pure TypeScript** — no Electron imports, tested against fixture directories. Supporting a new agent means implementing one interface. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
2. **Strict Electron security posture**: sandboxed renderer, context isolation, no node integration, locked-down navigation and permissions, CSP — all enforced by unit tests.
3. **Main process is the single source of truth**; the renderer hydrates from a snapshot and applies deltas.

## Development

```bash
npm install
npm run dev        # launch with HMR
npm test           # unit tests (Vitest)
npm run lint       # ESLint (type-aware)
npm run typecheck  # tsc, node + web projects
npm run build      # production build
```

Requires Node 22+.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The [roadmap](docs/ROADMAP.md) is broken into commit-sized, individually testable tasks — good first issues are labeled.

## License

[MIT](LICENSE)
