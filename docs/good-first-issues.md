# Good first issues

To be converted into labeled GitHub issues once the repository is public. Each is
self-contained, has an obvious test strategy, and touches the contributor-friendly
pure-TypeScript layers.

1. **Codex token usage** — Codex rollouts emit cumulative `token_count` event_msgs;
   delta consecutive counts into per-turn `TokenUsage`. See ADR 0002 §3.
   (`src/main/agents/codex-cli/parse.ts` + fixtures)
2. **New agent adapter: Gemini CLI** — implement `AgentAdapter` for
   `~/.gemini/tmp/<hash>/chats` (or current location) with fixtures. The interface
   is documented in ADR 0001; the Codex adapter is the reference implementation.
3. **Cost estimates** — optional per-model pricing table (user-editable in settings)
   turning token counts into dollar estimates on cards and rollups.
4. **Session search** — filter box on the board matching title/prompt/project.
5. **Settings UI** — a preferences pane for notification rules
   (`SettingsStore` and IPC already exist; needs renderer surface + IPC channel).
6. **Tray-resident lifecycle on Windows/Linux** — keep running in the tray when the
   window closes (see docs/testing/tray-checklist.md known gap).
7. **Timeline virtualization** — replace `content-visibility` with real windowing
   for very long sessions (>1000 events).
8. **Relative-time i18n** — use `Intl.RelativeTimeFormat` in `lib/format.ts`.
