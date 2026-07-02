export function Onboarding(): React.JSX.Element {
  return (
    <div
      data-testid="onboarding"
      className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <h2 className="text-lg font-semibold text-zinc-200">No agent sessions found</h2>
      <p className="max-w-md text-sm leading-relaxed text-zinc-500">
        AgentDeck watches{' '}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5">~/.claude/projects</code> and{' '}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5">~/.codex/sessions</code> for agent
        transcripts. Start a Claude Code or Codex CLI session in any project and it will appear here
        automatically — no configuration needed.
      </p>
    </div>
  )
}
