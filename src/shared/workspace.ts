/** Working-tree changes for one project directory (git worktree). */
export interface GitDiffStats {
  filesChanged: number
  insertions: number
  deletions: number
  untracked: number
}

export function hasChanges(stats: GitDiffStats): boolean {
  return (
    stats.filesChanged > 0 || stats.insertions > 0 || stats.deletions > 0 || stats.untracked > 0
  )
}
