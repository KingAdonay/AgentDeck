import { useEffect, useState } from 'react'
import type { AgentKind } from '../../../shared/domain'
import type { HistoryQuery, TaskRecord } from '../../../shared/history'
import {
  formatDateTime,
  formatLineDelta,
  formatTokens,
  shortModel,
  shortenPath
} from '../lib/format'

const PAGE_SIZE = 50
const DAY_MS = 24 * 60 * 60_000

type RangeFilter = '7d' | '30d' | '90d' | 'all'
type AgentFilter = AgentKind | 'all'

const RANGES: Array<{ value: RangeFilter; label: string; days: number | null }> = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
  { value: 'all', label: 'All time', days: null }
]

const AGENT_LABELS: Record<AgentKind, string> = {
  'claude-code': 'Claude Code',
  'codex-cli': 'Codex'
}

interface Props {
  /** Bumps whenever live sessions change, so new tasks show up without a manual refresh. */
  refreshToken: number
}

/**
 * Browse the local task history: every session AgentDeck has seen, kept
 * after the agent deletes its own transcript.
 */
export function HistoryView({ refreshToken }: Props): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [agent, setAgent] = useState<AgentFilter>('all')
  const [range, setRange] = useState<RangeFilter>('30d')
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [total, setTotal] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadedCount, setLoadedCount] = useState(PAGE_SIZE)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setLoadedCount(PAGE_SIZE)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let alive = true
    const days = RANGES.find((option) => option.value === range)?.days ?? null
    const query: HistoryQuery = { limit: loadedCount, offset: 0 }
    if (debouncedSearch.trim() !== '') query.search = debouncedSearch
    if (agent !== 'all') query.agent = agent
    if (days !== null) query.since = Date.now() - days * DAY_MS
    window.api.history.list(query).then(
      (response) => {
        if (!alive) return
        setTasks(response.tasks)
        setTotal(response.total)
        setPhase('ready')
      },
      () => {
        if (alive) setPhase('error')
      }
    )
    return () => {
      alive = false
    }
  }, [debouncedSearch, agent, range, loadedCount, refreshToken])

  return (
    <div data-testid="history-view" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-900 px-6 py-2">
        <input
          type="search"
          data-testid="history-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, prompt, project, branch…"
          className="w-72 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600"
        />
        <select
          data-testid="history-agent"
          value={agent}
          onChange={(event) => {
            setAgent(event.target.value as AgentFilter)
            setLoadedCount(PAGE_SIZE)
          }}
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
        >
          <option value="all">All agents</option>
          <option value="claude-code">Claude Code</option>
          <option value="codex-cli">Codex</option>
        </select>
        <select
          data-testid="history-range"
          value={range}
          onChange={(event) => {
            setRange(event.target.value as RangeFilter)
            setLoadedCount(PAGE_SIZE)
          }}
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
        >
          {RANGES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-zinc-500" data-testid="history-total">
          {total} {total === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
        {phase === 'loading' && <p className="text-sm text-zinc-600">Loading history…</p>}
        {phase === 'error' && (
          <p data-testid="history-error" className="text-sm text-red-400">
            Couldn&apos;t load task history.
          </p>
        )}
        {phase === 'ready' && tasks.length === 0 && (
          <p data-testid="history-empty" className="text-sm text-zinc-600">
            No tasks match these filters.
          </p>
        )}
        {phase === 'ready' && tasks.length > 0 && (
          <table className="w-full table-fixed text-left text-xs">
            <thead className="text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="w-40 py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Task</th>
                <th className="w-40 py-2 font-medium">Project</th>
                <th className="w-36 py-2 font-medium">Changes</th>
                <th className="w-24 py-2 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <HistoryRow key={task.key} task={task} />
              ))}
            </tbody>
          </table>
        )}
        {phase === 'ready' && tasks.length < total && (
          <button
            type="button"
            data-testid="history-load-more"
            onClick={() => setLoadedCount((count) => count + PAGE_SIZE)}
            className="mt-3 rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  )
}

function HistoryRow({ task }: { task: TaskRecord }): React.JSX.Element {
  const heading = task.title ?? task.highlight ?? `Session ${task.sessionId.slice(0, 8)}`
  const subline = task.title !== null ? task.highlight : null
  const lineDelta = formatLineDelta(task.linesAdded, task.linesRemoved, task.filesChanged)
  const tokens =
    task.inputTokens + task.cacheReadTokens + task.cacheCreationTokens + task.outputTokens

  return (
    <tr data-testid="history-row" className="border-b border-zinc-900 align-top">
      <td className="py-2 pr-3 text-zinc-400">{formatDateTime(task.lastActivityAt)}</td>
      <td className="py-2 pr-3">
        <p className="truncate font-medium text-zinc-100" title={heading}>
          {heading}
        </p>
        {subline !== null && (
          <p className="truncate text-zinc-500" title={subline}>
            {subline}
          </p>
        )}
        <p className="mt-0.5 text-zinc-600">
          {AGENT_LABELS[task.agent]}
          {task.model !== null && ` · ${shortModel(task.model)}`}
          {` · ${task.userMessageCount} ${task.userMessageCount === 1 ? 'prompt' : 'prompts'}`}
        </p>
      </td>
      <td className="py-2 pr-3 text-zinc-400">
        <p className="truncate" title={task.projectPath}>
          {shortenPath(task.projectPath)}
        </p>
        {task.gitBranch !== null && <p className="truncate text-zinc-600">⎇ {task.gitBranch}</p>}
      </td>
      <td className="py-2 pr-3 text-zinc-400" data-testid="history-lines">
        {lineDelta ?? '—'}
      </td>
      <td className="py-2 text-right text-zinc-400">{tokens > 0 ? formatTokens(tokens) : '—'}</td>
    </tr>
  )
}
