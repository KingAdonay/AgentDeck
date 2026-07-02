import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, sep } from 'node:path'
import type { AgentSession } from '../types'

export function defaultSessionsRoot(): string {
  return join(homedir(), '.codex', 'sessions')
}

/**
 * Codex nests transcripts by date: sessions/YYYY/MM/DD/rollout-<ts>-<id>.jsonl.
 * Unlike Claude Code, the project directory is not encoded in the path — it
 * arrives via session_meta events. projectKey is therefore the date path
 * (stable, but not a project), and the reducer swaps in the real cwd as soon
 * as the transcript's first lines are replayed.
 */
export function sessionRefForPath(
  sessionsRoot: string,
  filePath: string
): Pick<AgentSession, 'sessionId' | 'projectKey'> | null {
  if (!filePath.endsWith('.jsonl')) return null
  if (!filePath.startsWith(sessionsRoot + sep)) return null
  return {
    sessionId: basename(filePath, '.jsonl'),
    projectKey: dirname(relative(sessionsRoot, filePath))
  }
}

export async function discoverCodexSessions(sessionsRoot: string): Promise<AgentSession[]> {
  let entries: string[]
  try {
    entries = await readdir(sessionsRoot, { recursive: true })
  } catch {
    return []
  }

  const sessions: AgentSession[] = []
  for (const rel of entries) {
    if (!rel.endsWith('.jsonl')) continue
    const transcriptPath = join(sessionsRoot, rel)
    try {
      const info = await stat(transcriptPath)
      if (!info.isFile()) continue
      const projectKey = dirname(rel)
      sessions.push({
        agent: 'codex-cli',
        sessionId: basename(rel, '.jsonl'),
        transcriptPath,
        projectKey,
        // Placeholder until session_meta delivers the real cwd.
        projectPathGuess: projectKey,
        lastModifiedAt: info.mtimeMs,
        sizeBytes: info.size
      })
    } catch {
      // deleted between readdir and stat
    }
  }
  return sessions
}
