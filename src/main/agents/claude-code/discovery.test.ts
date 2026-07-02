import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeProjectSlug, discoverClaudeSessions, sessionRefForPath } from './discovery'

const fixtureRoot = join(__dirname, '__fixtures__', 'projects')

describe('decodeProjectSlug', () => {
  it('decodes a path slug', () => {
    expect(decodeProjectSlug('-Users-jane-dev-webapp')).toBe('/Users/jane/dev/webapp')
  })
})

describe('sessionRefForPath', () => {
  it('identifies a transcript path', () => {
    expect(
      sessionRefForPath(fixtureRoot, join(fixtureRoot, '-Users-jane-dev-api', 'abc.jsonl'))
    ).toEqual({ sessionId: 'abc', projectKey: '-Users-jane-dev-api' })
  })

  it('rejects non-jsonl files, root-level files, and foreign paths', () => {
    expect(
      sessionRefForPath(fixtureRoot, join(fixtureRoot, '-Users-jane-dev-api', 'notes.txt'))
    ).toBeNull()
    expect(sessionRefForPath(fixtureRoot, join(fixtureRoot, 'stray.jsonl'))).toBeNull()
    expect(sessionRefForPath(fixtureRoot, '/somewhere/else/abc.jsonl')).toBeNull()
  })
})

describe('discoverClaudeSessions', () => {
  it('finds every session transcript, grouped by project', async () => {
    const sessions = await discoverClaudeSessions(fixtureRoot)

    expect(sessions).toHaveLength(3)
    const ids = sessions.map((s) => s.sessionId).sort()
    expect(ids).toEqual([
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    ])

    const webapp = sessions.filter((s) => s.projectKey === '-Users-jane-dev-webapp')
    expect(webapp).toHaveLength(2)
    for (const session of webapp) {
      expect(session.agent).toBe('claude-code')
      expect(session.projectPathGuess).toBe('/Users/jane/dev/webapp')
      expect(session.sizeBytes).toBeGreaterThan(0)
      expect(session.lastModifiedAt).toBeGreaterThan(0)
      expect(session.transcriptPath).toContain('-Users-jane-dev-webapp')
    }
  })

  it('ignores non-jsonl files and root-level strays', async () => {
    const sessions = await discoverClaudeSessions(fixtureRoot)
    expect(sessions.every((s) => s.transcriptPath.endsWith('.jsonl'))).toBe(true)
    expect(sessions.some((s) => s.transcriptPath.endsWith('stray.jsonl'))).toBe(false)
  })

  it('returns [] when the root does not exist (agent not installed)', async () => {
    expect(await discoverClaudeSessions('/nonexistent/claude/projects')).toEqual([])
  })
})
