import type { SessionState } from '../../../shared/domain'
import { sessionKey } from '../../../shared/domain'
import { shortenPath } from '../lib/format'
import { SessionCard } from './SessionCard'

interface Props {
  sessions: SessionState[]
  now: number
  selectedKey: string | null
  onSelect: (key: string) => void
}

interface ProjectGroup {
  projectPath: string
  sessions: SessionState[]
  latestActivity: number
}

function groupByProject(sessions: SessionState[]): ProjectGroup[] {
  const groups = new Map<string, SessionState[]>()
  for (const session of sessions) {
    const list = groups.get(session.projectPath) ?? []
    list.push(session)
    groups.set(session.projectPath, list)
  }
  return [...groups.entries()]
    .map(([projectPath, list]) => ({
      projectPath,
      sessions: list.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0)),
      latestActivity: Math.max(...list.map((s) => s.lastActivityAt ?? 0))
    }))
    .sort((a, b) => b.latestActivity - a.latestActivity)
}

export function Board({ sessions, now, selectedKey, onSelect }: Props): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6">
      {groupByProject(sessions).map((group) => (
        <section key={group.projectPath} data-testid="project-group">
          <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-zinc-300">
            {shortenPath(group.projectPath)}
            <span className="text-xs font-normal text-zinc-600">{group.projectPath}</span>
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
      ))}
    </div>
  )
}
