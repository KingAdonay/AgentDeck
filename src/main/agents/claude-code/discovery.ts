import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { AgentSession } from '../types'

export function defaultProjectsRoot(): string {
  return join(homedir(), '.claude', 'projects')
}

/**
 * Claude Code encodes the project cwd by replacing every path separator AND
 * every pre-existing dash with '-', so decoding is ambiguous for dashed
 * directory names ('/dev/my-app' and '/dev/my/app' collide). This guess is
 * display-only; the authoritative path is the cwd on transcript events.
 */
export function decodeProjectSlug(slug: string): string {
  return slug.replace(/-/g, '/')
}

export function sessionRefForPath(
  projectsRoot: string,
  filePath: string
): Pick<AgentSession, 'sessionId' | 'projectKey'> | null {
  if (!filePath.endsWith('.jsonl')) return null
  const projectDir = dirname(filePath)
  if (dirname(projectDir) !== projectsRoot) return null
  return { sessionId: basename(filePath, '.jsonl'), projectKey: basename(projectDir) }
}

/**
 * Enumerate every session transcript under the projects root. Tolerant by
 * design: a missing root (Claude Code not installed) or files deleted
 * mid-scan yield fewer sessions, never an error.
 */
export async function discoverClaudeSessions(projectsRoot: string): Promise<AgentSession[]> {
  let projectDirs
  try {
    projectDirs = await readdir(projectsRoot, { withFileTypes: true })
  } catch {
    return []
  }

  const sessions: AgentSession[] = []
  for (const entry of projectDirs) {
    if (!entry.isDirectory()) continue
    const projectKey = entry.name
    const projectDir = join(projectsRoot, projectKey)

    let files: string[]
    try {
      files = await readdir(projectDir)
    } catch {
      continue
    }

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue
      const transcriptPath = join(projectDir, file)
      try {
        const info = await stat(transcriptPath)
        sessions.push({
          agent: 'claude-code',
          sessionId: basename(file, '.jsonl'),
          transcriptPath,
          projectKey,
          projectPathGuess: decodeProjectSlug(projectKey),
          lastModifiedAt: info.mtimeMs,
          sizeBytes: info.size
        })
      } catch {
        // deleted between readdir and stat
      }
    }
  }
  return sessions
}
