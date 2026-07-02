import { useEffect, useState } from 'react'
import { deriveStatus } from '../../shared/status'
import { Board } from './components/Board'
import { DetailPanel } from './components/DetailPanel'
import { Onboarding } from './components/Onboarding'
import { useSessionsStore } from './store'

function App(): React.JSX.Element {
  const { sessions, phase, errorMessage, hydrate, upsert } = useSessionsStore()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    void hydrate()
    return window.api.sessions.onUpdated((payload) => upsert(payload.sessions))
  }, [hydrate, upsert])

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
            <Board
              sessions={sessionList}
              now={now}
              selectedKey={selectedKey}
              onSelect={(key) => setSelectedKey((current) => (current === key ? null : key))}
            />
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
