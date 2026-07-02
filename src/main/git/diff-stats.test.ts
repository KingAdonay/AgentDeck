import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  countUntracked,
  parseShortstat,
  readGitDiffStats,
  WorkspaceStatsService
} from './diff-stats'

describe('parseShortstat', () => {
  it('parses the full form', () => {
    expect(parseShortstat(' 3 files changed, 45 insertions(+), 10 deletions(-)\n')).toEqual({
      filesChanged: 3,
      insertions: 45,
      deletions: 10
    })
  })

  it('parses singular and partial forms', () => {
    expect(parseShortstat(' 1 file changed, 1 insertion(+)\n')).toEqual({
      filesChanged: 1,
      insertions: 1,
      deletions: 0
    })
    expect(parseShortstat('')).toEqual({ filesChanged: 0, insertions: 0, deletions: 0 })
  })
})

describe('countUntracked', () => {
  it('counts only ?? lines', () => {
    expect(countUntracked('?? new.ts\n M changed.ts\n?? dir/\n')).toBe(2)
    expect(countUntracked('')).toBe(0)
  })
})

describe('readGitDiffStats against a real repo', () => {
  let repo: string

  const git = (...args: string[]): void => {
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: repo })
  }

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'agentdeck-git-'))
    git('init', '-q')
    writeFileSync(join(repo, 'a.txt'), 'one\ntwo\n')
    git('add', '.')
    git('commit', '-qm', 'init')
  })

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('reports modifications and untracked files', async () => {
    writeFileSync(join(repo, 'a.txt'), 'one\ntwo\nthree\nfour\n') // +2 lines
    writeFileSync(join(repo, 'new.txt'), 'hello\n') // untracked

    expect(await readGitDiffStats(repo)).toEqual({
      filesChanged: 1,
      insertions: 2,
      deletions: 0,
      untracked: 1
    })
  })

  it('returns null for a non-repo and a missing directory', async () => {
    const plain = mkdtempSync(join(tmpdir(), 'agentdeck-plain-'))
    try {
      expect(await readGitDiffStats(plain)).toBeNull()
    } finally {
      rmSync(plain, { recursive: true, force: true })
    }
    expect(await readGitDiffStats('/definitely/not/here')).toBeNull()
  })

  it('WorkspaceStatsService reports change only when stats move', async () => {
    const service = new WorkspaceStatsService()
    expect(await service.refresh([repo, '/definitely/not/here'])).toBe(true)
    expect(service.getSnapshot()[repo]?.filesChanged).toBe(1)
    expect(service.getSnapshot()['/definitely/not/here']).toBeUndefined()

    expect(await service.refresh([repo])).toBe(false) // nothing moved
  })
})
