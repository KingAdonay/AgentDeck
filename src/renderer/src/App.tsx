import { useEffect, useState } from 'react'
import { deriveStatus } from '../../shared/status'
import { Board } from './components/Board'
import { DetailPanel } from './components/DetailPanel'
import { Onboarding } from './components/Onboarding'
import type { BoardSort, StatusFilter } from './lib/boardView'
import { useSessionsStore } from './store'

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'working', label: 'Working' },
  { value: 'awaiting-input', label: 'Needs input' },
  { value: 'idle', label: 'Idle' },
  { value: 'done', label: 'Done' }
]

function App(): React.JSX.Element {
  const { sessions, workspaceStats, phase, errorMessage, hydrate, upsert, setWorkspaceStats } =
    useSessionsStore()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<BoardSort>('activity')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    void hydrate()
    const unsubscribeSessions = window.api.sessions.onUpdated((payload) => upsert(payload.sessions))
    const unsubscribeWorkspace = window.api.workspace.onUpdated((payload) =>
      setWorkspaceStats(payload.stats)
    )
    return () => {
      unsubscribeSessions()
      unsubscribeWorkspace()
    }
  }, [hydrate, upsert, setWorkspaceStats])

  useEffect(() => {
    return window.api.sessions.onReveal((payload) => setSelectedKey(payload.sessionKey))
  }, [])

  // Status decays with time even without new events; tick to re-derive it.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  const sessionList = Object.values(sessions)
  const statusCounts = { working: 0, 'awaiting-input': 0 }
  for (const session of sessionList) {
    const status = deriveStatus(session.lastEventKind, session.lastActivityAt, now)
    if (status === 'working' || status === 'awaiting-input') statusCounts[status] += 1
  }
  const selected = selectedKey !== null ? sessions[selectedKey] : undefined

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <h1 className="text-base font-bold tracking-tight">AgentDeck</h1>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span data-testid="count-working">
            <span className="font-semibold text-emerald-400">{statusCounts.working}</span> working
          </span>
          <span data-testid="count-awaiting">
            <span className="font-semibold text-amber-400">{statusCounts['awaiting-input']}</span>{' '}
            need input
          </span>
          <span>{sessionList.length} sessions</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {phase === 'loading' && (
            <p className="p-6 text-sm text-zinc-600">Scanning for agent sessions…</p>
          )}
          {phase === 'error' && (
            <div
              data-testid="error-state"
              className="m-6 rounded-lg border border-red-900 bg-red-950/40 p-4"
            >
              <p className="text-sm font-medium text-red-300">Couldn&apos;t load sessions</p>
              <p className="mt-1 text-xs text-red-400/80">{errorMessage}</p>
            </div>
          )}
          {phase === 'ready' && sessionList.length === 0 && <Onboarding />}
          {phase === 'ready' && sessionList.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-b border-zinc-900 px-6 py-2">
                {FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`filter-${value}`}
                    onClick={() => setFilter(value)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      filter === value
                        ? 'bg-zinc-100 font-medium text-zinc-900'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <select
                  data-testid="sort-select"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as BoardSort)}
                  className="ml-auto rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                >
                  <option value="activity">Sort: recent activity</option>
                  <option value="tokens">Sort: tokens</option>
                </select>
              </div>
              <Board
                sessions={sessionList}
                workspaceStats={workspaceStats}
                now={now}
                filter={filter}
                sort={sort}
                selectedKey={selectedKey}
                onSelect={(key) => setSelectedKey((current) => (current === key ? null : key))}
              />
            </>
          )}
        </main>

        {selected !== undefined && selectedKey !== null && (
          <DetailPanel
            sessionKey={selectedKey}
            state={selected}
            now={now}
            onClose={() => setSelectedKey(null)}
          />
        )}
      </div>
    </div>
  )
}

export default App
