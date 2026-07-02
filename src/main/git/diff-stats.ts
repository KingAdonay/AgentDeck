import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitDiffStats } from '../../shared/workspace'

const run = promisify(execFile)

/** Parse `git diff --shortstat` output: " 3 files changed, 45 insertions(+), 10 deletions(-)" */
export function parseShortstat(
  output: string
): Pick<GitDiffStats, 'filesChanged' | 'insertions' | 'deletions'> {
  const files = /(\d+) files? changed/.exec(output)
  const insertions = /(\d+) insertions?\(\+\)/.exec(output)
  const deletions = /(\d+) deletions?\(-\)/.exec(output)
  const num = (match: RegExpExecArray | null): number =>
    match?.[1] !== undefined ? Number(match[1]) : 0
  return { filesChanged: num(files), insertions: num(insertions), deletions: num(deletions) }
}

/** Count untracked files in `git status --porcelain` output. */
export function countUntracked(porcelain: string): number {
  return porcelain.split('\n').filter((line) => line.startsWith('??')).length
}

/**
 * Working-tree changes vs HEAD for one directory. Returns null when the
 * answer is "no answer" rather than "no changes": not a git repo, git not
 * installed, directory gone, or a repo with no commits yet.
 */
export async function readGitDiffStats(cwd: string): Promise<GitDiffStats | null> {
  try {
    const [diff, status] = await Promise.all([
      run('git', ['diff', '--shortstat', 'HEAD'], { cwd, timeout: 5_000 }),
      run('git', ['status', '--porcelain'], { cwd, timeout: 5_000 })
    ])
    return { ...parseShortstat(diff.stdout), untracked: countUntracked(status.stdout) }
  } catch {
    return null
  }
}

/**
 * Polls diff stats for a set of project paths, remembering the last result so
 * callers can broadcast only on change.
 */
export class WorkspaceStatsService {
  private stats: Record<string, GitDiffStats> = {}

  getSnapshot(): Record<string, GitDiffStats> {
    return this.stats
  }

  /** Returns true when anything changed since the last refresh. */
  async refresh(projectPaths: readonly string[]): Promise<boolean> {
    const next: Record<string, GitDiffStats> = {}
    for (const path of projectPaths) {
      const result = await readGitDiffStats(path)
      if (result !== null) next[path] = result
    }
    const changed = JSON.stringify(next) !== JSON.stringify(this.stats)
    this.stats = next
    return changed
  }
}
