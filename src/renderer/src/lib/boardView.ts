import type { SessionState, SessionStatus, TokenUsage } from '../../../shared/domain'
import { deriveStatus } from '../../../shared/status'
import { aggregateUsage, totalTokens } from '../../../shared/usage'

export type StatusFilter = SessionStatus | 'all'
export type BoardSort = 'activity' | 'tokens'

export interface BoardGroup {
  projectPath: string
  sessions: SessionState[]
  latestActivity: number
  usage: TokenUsage
}

/**
 * Pure board projection: filter by derived status, group by project, sort
 * sessions within groups and the groups themselves by the chosen criterion.
 */
export function buildBoardView(
  states: readonly SessionState[],
  now: number,
  filter: StatusFilter,
  sort: BoardSort
): BoardGroup[] {
  const visible =
    filter === 'all'
      ? [...states]
      : states.filter(
          (state) => deriveStatus(state.lastEventKind, state.lastActivityAt, now) === filter
        )

  const byProject = new Map<string, SessionState[]>()
  for (const state of visible) {
    const list = byProject.get(state.projectPath) ?? []
    list.push(state)
    byProject.set(state.projectPath, list)
  }

  const bySort = (a: SessionState, b: SessionState): number =>
    sort === 'tokens'
      ? totalTokens(b.usage) - totalTokens(a.usage)
      : (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0)

  const groups: BoardGroup[] = [...byProject.entries()].map(([projectPath, sessions]) => ({
    projectPath,
    sessions: sessions.sort(bySort),
    latestActivity: Math.max(...sessions.map((s) => s.lastActivityAt ?? 0)),
    usage: aggregateUsage(sessions)
  }))

  return groups.sort((a, b) =>
    sort === 'tokens'
      ? totalTokens(b.usage) - totalTokens(a.usage)
      : b.latestActivity - a.latestActivity
  )
}
