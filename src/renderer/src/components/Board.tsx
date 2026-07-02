import type { SessionState } from '../../../shared/domain'
import { sessionKey } from '../../../shared/domain'
import { totalTokens } from '../../../shared/usage'
import { hasChanges, type GitDiffStats } from '../../../shared/workspace'
import { buildBoardView, type BoardSort, type StatusFilter } from '../lib/boardView'
import { formatTokens, shortenPath } from '../lib/format'
import { SessionCard } from './SessionCard'

interface Props {
  sessions: SessionState[]
  workspaceStats: Record<string, GitDiffStats>
  now: number
  filter: StatusFilter
  sort: BoardSort
  selectedKey: string | null
  onSelect: (key: string) => void
}

function DiffSummary({ stats }: { stats: GitDiffStats }): React.JSX.Element {
  return (
    <span data-testid="diff-summary" className="flex items-center gap-2 font-mono text-xs">
      <span className="text-emerald-500">+{stats.insertions}</span>
      <span className="text-red-400">−{stats.deletions}</span>
      <span className="text-zinc-500">
        {stats.filesChanged} {stats.filesChanged === 1 ? 'file' : 'files'}
        {stats.untracked > 0 && `, ${stats.untracked} new`}
      </span>
    </span>
  )
}

export function Board({
  sessions,
  workspaceStats,
  now,
  filter,
  sort,
  selectedKey,
  onSelect
}: Props): React.JSX.Element {
  const groups = buildBoardView(sessions, now, filter, sort)

  if (groups.length === 0) {
    return (
      <p data-testid="empty-filter" className="p-6 text-sm text-zinc-600">
        No sessions match this filter.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6">
      {groups.map((group) => {
        const diff = workspaceStats[group.projectPath]
        const tokens = totalTokens(group.usage)
        return (
          <section key={group.projectPath} data-testid="project-group">
            <h2 className="mb-2 flex items-baseline gap-3 text-sm font-semibold text-zinc-300">
              {shortenPath(group.projectPath)}
              <span className="hidden text-xs font-normal text-zinc-600 sm:inline">
                {group.projectPath}
              </span>
              <span className="ml-auto flex items-center gap-4 font-normal">
                {tokens > 0 && (
                  <span className="text-xs text-zinc-500">{formatTokens(tokens)} tokens</span>
                )}
                {diff !== undefined && hasChanges(diff) && <DiffSummary stats={diff} />}
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
              {group.sessions.map((session) => {
                const key = sessionKey(session.agent, session.projectKey, session.sessionId)
                return (
                  <SessionCard
                    key={key}
                    state={session}
                    now={now}
                    selected={key === selectedKey}
                    onSelect={() => onSelect(key)}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
