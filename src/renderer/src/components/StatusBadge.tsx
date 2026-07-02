import type { SessionStatus } from '../../../shared/domain'

const STYLES: Record<SessionStatus, { badge: string; dot: string; label: string }> = {
  working: { badge: 'bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400', label: 'working' },
  'awaiting-input': {
    badge: 'bg-amber-500/10 text-amber-400',
    dot: 'bg-amber-400',
    label: 'needs input'
  },
  idle: { badge: 'bg-zinc-500/10 text-zinc-400', dot: 'bg-zinc-500', label: 'idle' },
  done: { badge: 'bg-sky-500/10 text-sky-400', dot: 'bg-sky-400', label: 'done' }
}

export function StatusBadge({ status }: { status: SessionStatus }): React.JSX.Element {
  const style = STYLES[status]
  const pulse = status === 'working' || status === 'awaiting-input'
  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {style.label}
    </span>
  )
}
