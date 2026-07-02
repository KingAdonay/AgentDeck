# ADR 0002: Codex CLI adapter mapping

Status: accepted · Date: 2026-07-02 · Amended: 2026-07-02 (decisions 2–3)

## Context

Codex CLI persists sessions as rollout files (`~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<id>.jsonl`), each line `{timestamp, type, payload}`. Unlike Claude Code, the project directory is **not** encoded in the file path — it arrives inside the transcript (`session_meta.payload.cwd`, repeated in `turn_context`).

## Decisions

1. **projectKey is the date path** (`2026/07/01`) — stable and cheap at discovery time — and the real project path flows through a `session-meta` event carrying `cwd`/`gitBranch` (domain extension in this ADR). The UI groups by `projectPath`, so grouping is correct as soon as the first lines replay.
2. **`session_meta`, `turn_context`, `response_item`, and the `token_count` subtype of `event_msg` are consumed.** Other `event_msg` subtypes duplicate response items (`agent_message`, `user_message`) and would double-count the timeline, so they stay ignored. The model name comes from `turn_context.model` and flows through the `session-meta` event. _(Amended: v1 ignored all `event_msg` lines and dropped the model.)_
3. **Token usage is reported as a cumulative-replace snapshot.** Codex `token_count` events carry _cumulative_ totals (`info.total_token_usage`), so the parser maps the latest snapshot to `session-meta.cumulativeUsage` and the reducer replaces `state.usage` instead of accumulating. Replace beats delta-ing consecutive counts: the parser stays stateless per-line and a missed line can't cause drift. Codex's `input_tokens` includes cached tokens; the adapter subtracts `cached_input_tokens` back out to match the `TokenUsage` convention. _(Amended: v1 deliberately reported zero usage.)_
4. `function_call` descriptions come from the `command` field of the JSON-encoded `arguments`; `function_call_output` errors are derived from `metadata.exit_code` in the JSON-encoded `output`. Both degrade to "no description" / "no error" on unknown shapes.
5. Developer/system messages and tag-wrapped user content (`<environment_context>`, `<user_instructions>`) are filtered by the shared injected-content heuristic (ADR 0001 §5).

## Verification

Format cross-checked against the upstream rollout persistence docs and community reverse-engineering writeups (no local Codex installation existed to sample). The fixture in `__fixtures__/sessions/` encodes the format assumptions; if a Codex update breaks parsing, the parser degrades to fewer events rather than errors, per ADR 0001 §3.
