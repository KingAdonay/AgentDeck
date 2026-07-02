# ADR 0001: Normalized domain model and adapter contract

Status: accepted · Date: 2026-07-02

## Context

AgentDeck observes sessions from multiple agent CLIs, each with its own on-disk transcript format (Claude Code: JSONL under `~/.claude/projects`; Codex CLI: `~/.codex/sessions`; more later). The UI and status logic must not know about any of them.

## Decision

1. **One normalized event model** (`AgentEvent`): `user-message`, `assistant-message`, `tool-call`, `tool-result`, `session-meta`. Everything downstream (status machine, store, UI, notifications) consumes only this.
2. **`AgentAdapter` is the only agent-specific surface**: discovery, path identification, watch roots, and line parsing. Adapters are pure TypeScript (no Electron imports), fixture-tested.
3. **Parsers never throw.** Transcripts are written concurrently by third-party tools; malformed lines, truncated writes, and unknown entry types are expected and yield zero events. Unknown fields are ignored, so agent CLI updates degrade gracefully instead of crashing.
4. **Sidechain entries are skipped** (`isSidechain: true` in Claude Code = subagent transcripts). The main chain already reflects the session's observable activity; counting subagent chatter would inflate status and cost.
5. **System-injected user content is not a user message.** Claude Code logs IDE context (`<ide_opened_file>…`) and system reminders as `type: user`; these must not flip a session to "user replied". Heuristic: array-content text blocks wrapped in `<…>` tags are dropped.
6. **Usage is deduplicated by provider `messageId`.** A single assistant message spans multiple JSONL entries (text block, tool_use block) that repeat identical usage; aggregation counts a messageId once (adjacent-dedupe, which matches how entries are written).
7. **Project identity**: `projectKey` is the agent's own directory encoding (unique, stable). Decoding it to a path is best-effort (`-Users-jane-dev-my-app` is ambiguous for dashed dir names); the authoritative project path is the `cwd` carried on events.

## Consequences

- Adding an agent = implement `AgentAdapter` + fixtures; no UI or store changes.
- The status machine (`SessionStatus`: `working | awaiting-input | idle | done`) operates on event kind + recency only, so it is agent-agnostic and table-testable.
- Fixtures are sanitized copies of real transcripts and double as format documentation.
