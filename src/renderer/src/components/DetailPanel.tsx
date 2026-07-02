import { useEffect, useState } from 'react'
import type { AgentEvent, SessionState } from '../../../shared/domain'
import { deriveStatus } from '../../../shared/status'
import { relativeTime } from '../lib/format'
import { StatusBadge } from './StatusBadge'

interface Props {
  sessionKey: string
  state: SessionState
  now: number
  onClose: () => void
}

function eventLabel(event: AgentEvent): { icon: string; tone: string; text: string } | null {
  switch (event.kind) {
    case 'user-message':
      return { icon: '›', tone: 'text-zinc-100', text: event.text }
    case 'assistant-message':
      return { icon: '✦', tone: 'text-zinc-300', text: event.text }
    case 'tool-call':
      return {
        icon: '⚙',
        tone: 'text-zinc-400',
        text:
          event.description !== undefined
            ? `${event.toolName} — ${event.description}`
            : event.toolName
      }
    case 'tool-result':
      return event.isError ? { icon: '✗', tone: 'text-red-400', text: 'tool failed' } : null // successful results are noise next to their tool call
    case 'session-meta':
      return null
  }
}

export function DetailPanel({ sessionKey, state, now, onClose }: Props): React.JSX.Element {
  const [events, setEvents] = useState<AgentEvent[] | null>(null)

  useEffect(() => {
    let alive = true
    void window.api.sessions.getEvents(sessionKey).then((response) => {
      if (alive) setEvents(response.events)
    })
    return () => {
      alive = false
    }
    // Re-fetch when new activity lands on this session.
  }, [sessionKey, state.lastActivityAt])

  const rows = (events ?? [])
    .map((event) => ({ event, label: eventLabel(event) }))
    .filter(
      (row): row is { event: AgentEvent; label: NonNullable<ReturnType<typeof eventLabel>> } =>
        row.label !== null
    )

  return (
    <aside
      data-testid="detail-panel"
      className="flex w-[26rem] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950"
    >
      <header className="border-b border-zinc-800 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">
            {state.title ?? state.lastPrompt ?? state.sessionId}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded px-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <StatusBadge status={deriveStatus(state.lastEventKind, state.lastActivityAt, now)} />
          <span className="truncate">{state.projectPath}</span>
          {state.gitBranch !== null && <span>⎇ {state.gitBranch}</span>}
        </div>
      </header>

      <ol className="flex-1 overflow-y-auto p-4">
        {events === null && <li className="text-xs text-zinc-600">Loading timeline…</li>}
        {events !== null && rows.length === 0 && (
          <li className="text-xs text-zinc-600">No events recorded for this session yet.</li>
        )}
        {rows.map(({ event, label }, index) => (
          <li
            key={index}
            data-testid="timeline-event"
            data-kind={event.kind}
            className="flex gap-3 border-b border-zinc-900 py-2 last:border-b-0"
            style={{ contentVisibility: 'auto' }}
          >
            <span className="w-4 shrink-0 text-center text-zinc-600">{label.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-xs leading-relaxed break-words ${label.tone}`}>
                {label.text.length > 300 ? `${label.text.slice(0, 300)}…` : label.text}
              </p>
              {event.timestamp !== null && (
                <p className="mt-0.5 text-[10px] text-zinc-700">
                  {relativeTime(event.timestamp, now)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}
