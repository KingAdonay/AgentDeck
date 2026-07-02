import type { SessionState } from '../../../shared/domain'
import { deriveStatus } from '../../../shared/status'
import { totalInputTokens } from '../../../shared/usage'
import { formatDuration, formatTokens, relativeTime, shortModel } from '../lib/format'
import { StatusBadge } from './StatusBadge'

interface Props {
  state: SessionState
  now: number
  selected: boolean
  onSelect: () => void
}

export function SessionCard({ state, now, selected, onSelect }: Props): React.JSX.Element {
  const title = state.title ?? state.lastPrompt ?? `Session ${state.sessionId.slice(0, 8)}`
  const duration = formatDuration(state.firstActivityAt, state.lastActivityAt)

  return (
    <button
      type="button"
      data-testid="session-card"
      onClick={onSelect}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-zinc-500 bg-zinc-800/80'
          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="truncate text-sm font-medium text-zinc-100">{title}</span>
        <StatusBadge status={deriveStatus(state.lastEventKind, state.lastActivityAt, now)} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        {state.gitBranch !== null && <span className="truncate">⎇ {state.gitBranch}</span>}
        {state.model !== null && <span>{shortModel(state.model)}</span>}
        <span>
          {state.userMessageCount} {state.userMessageCount === 1 ? 'prompt' : 'prompts'} ·{' '}
          {state.toolCallCount} tool {state.toolCallCount === 1 ? 'call' : 'calls'}
        </span>
        {totalInputTokens(state.usage) > 0 && (
          <span data-testid="card-tokens">
            {formatTokens(totalInputTokens(state.usage))} in ·{' '}
            {formatTokens(state.usage.outputTokens)} out
          </span>
        )}
      </div>

      <div className="mt-1 text-xs text-zinc-600">
        {relativeTime(state.lastActivityAt, now)}
        {duration !== null && ` · ran ${duration}`}
      </div>
    </button>
  )
}
