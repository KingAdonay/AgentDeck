import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyEvents, createSessionState } from '../../sessions/reduce'
import { discoverCodexSessions, sessionRefForPath } from './discovery'
import { CodexCliAdapter } from './index'
import { parseCodexLine } from './parse'

const fixtureRoot = join(__dirname, '__fixtures__', 'sessions')
const fixtureFile = join(
  fixtureRoot,
  '2026',
  '07',
  '01',
  'rollout-2026-07-01T09-00-00-cccccccc-cccc-cccc-cccc-cccccccccccc.jsonl'
)

describe('discoverCodexSessions', () => {
  it('walks nested date directories', async () => {
    const sessions = await discoverCodexSessions(fixtureRoot)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      agent: 'codex-cli',
      sessionId: 'rollout-2026-07-01T09-00-00-cccccccc-cccc-cccc-cccc-cccccccccccc',
      projectKey: join('2026', '07', '01')
    })
    expect(sessions[0]?.sizeBytes).toBeGreaterThan(0)
  })

  it('returns [] when the root does not exist (agent not installed)', async () => {
    expect(await discoverCodexSessions('/nonexistent/codex/sessions')).toEqual([])
  })
})

describe('sessionRefForPath', () => {
  it('identifies transcripts under the root and rejects others', () => {
    expect(sessionRefForPath(fixtureRoot, fixtureFile)).toEqual({
      sessionId: 'rollout-2026-07-01T09-00-00-cccccccc-cccc-cccc-cccc-cccccccccccc',
      projectKey: join('2026', '07', '01')
    })
    expect(sessionRefForPath(fixtureRoot, '/elsewhere/rollout-x.jsonl')).toBeNull()
    expect(sessionRefForPath(fixtureRoot, join(fixtureRoot, '2026', 'notes.txt'))).toBeNull()
  })
})

describe('parseCodexLine on the fixture rollout', () => {
  const events = readFileSync(fixtureFile, 'utf8')
    .split('\n')
    .flatMap((line) => parseCodexLine(line))

  it('produces the expected normalized sequence', () => {
    expect(events.map((e) => e.kind)).toEqual([
      'session-meta', // session_meta: cwd + branch
      'user-message',
      'session-meta', // turn_context: cwd
      'tool-call', // function_call exec_command
      'tool-result', // exit 0
      'tool-call', // local_shell_call
      'tool-result', // exit 1 → error
      'assistant-message'
    ])
  })

  it('extracts workspace context from session_meta', () => {
    expect(events[0]).toEqual({
      kind: 'session-meta',
      timestamp: null,
      cwd: '/Users/jane/dev/api-service',
      gitBranch: 'feat/rate-limit'
    })
  })

  it('filters developer instructions, injected context, reasoning, and event_msg duplicates', () => {
    const texts = events
      .filter((e) => e.kind === 'user-message' || e.kind === 'assistant-message')
      .map((e) => e.text)
    expect(texts).toHaveLength(2)
    expect(texts[0]).toBe('Add rate limiting to the public API endpoints')
    expect(texts.join(' ')).not.toContain('You are Codex')
    expect(texts.join(' ')).not.toContain('environment_context')
    expect(texts.join(' ')).not.toContain('Duplicate')
  })

  it('describes tool calls from arguments and shell actions', () => {
    const calls = events.filter((e) => e.kind === 'tool-call')
    expect(calls[0]).toMatchObject({
      toolName: 'exec_command',
      description: 'bash -lc ls src/middleware'
    })
    expect(calls[1]).toMatchObject({ toolName: 'shell', description: 'rg limiter src' })
  })

  it('derives tool-result errors from shell exit codes', () => {
    const results = events.filter((e) => e.kind === 'tool-result')
    expect(results.map((r) => r.isError)).toEqual([false, true])
  })

  it('never throws on garbage', () => {
    expect(parseCodexLine('not json {{{')).toEqual([])
    expect(parseCodexLine('{"type":"response_item"}')).toEqual([])
    expect(parseCodexLine('{"type":"response_item","payload":{"type":"message"}}')).toEqual([])
  })
})

describe('end-to-end through the reducer (proves the AgentAdapter abstraction)', () => {
  it('replays a Codex rollout into the same SessionState the UI consumes', async () => {
    const adapter = new CodexCliAdapter(fixtureRoot)
    const [session] = await adapter.discoverSessions()
    expect(session).toBeDefined()
    if (!session) return

    const lines = readFileSync(session.transcriptPath, 'utf8').split('\n')
    const state = applyEvents(
      createSessionState(session),
      lines.flatMap((line) => adapter.parseLine(line))
    )

    expect(state.agent).toBe('codex-cli')
    expect(state.projectPath).toBe('/Users/jane/dev/api-service') // from session_meta, not path
    expect(state.gitBranch).toBe('feat/rate-limit')
    expect(state.userMessageCount).toBe(1)
    expect(state.toolCallCount).toBe(2)
    expect(state.lastAssistantText).toContain('token-bucket middleware')
    expect(state.lastEventKind).toBe('assistant-message')
    expect(state.lastActivityAt).toBe(Date.parse('2026-07-01T09:00:07.000Z'))
  })
})
