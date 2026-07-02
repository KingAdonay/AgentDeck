import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseClaudeLine } from '../agents/claude-code/parse'
import type { AgentSession } from '../agents/types'
import type { AgentEvent } from '../../shared/domain'
import { deriveStatus } from '../../shared/status'
import { applyEvents, createSessionState } from './reduce'

const session: AgentSession = {
  agent: 'claude-code',
  sessionId: '11111111-1111-1111-1111-111111111111',
  transcriptPath: '/fake/path.jsonl',
  projectKey: '-Users-jane-dev-webapp',
  projectPathGuess: '/Users/jane/dev/webapp',
  lastModifiedAt: 0,
  sizeBytes: 0
}

function fixtureEvents(): ReturnType<typeof parseClaudeLine> {
  const file = join(
    __dirname,
    '..',
    'agents',
    'claude-code',
    '__fixtures__',
    'projects',
    '-Users-jane-dev-webapp',
    '11111111-1111-1111-1111-111111111111.jsonl'
  )
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line) => parseClaudeLine(line))
}

describe('reducing the rich fixture', () => {
  const state = applyEvents(createSessionState(session), fixtureEvents())

  it('captures identity and workspace context', () => {
    expect(state.projectPath).toBe('/Users/jane/dev/web-app') // real cwd beats the slug guess
    expect(state.gitBranch).toBe('feature/dark-mode')
    expect(state.model).toBe('claude-opus-4-8')
    expect(state.title).toBe('Add dark mode toggle')
    expect(state.lastPrompt).toBe('Add a dark mode toggle to the settings page')
  })

  it('counts activity', () => {
    expect(state.userMessageCount).toBe(1)
    expect(state.toolCallCount).toBe(1)
    expect(state.lastAssistantText).toContain('Done — the toggle is wired up')
  })

  it('deduplicates usage across entries of the same assistant message', () => {
    // msg_aaa appears twice (text + tool_use entries) and must count once;
    // msg_bbb counts once more.
    expect(state.usage).toEqual({
      inputTokens: 2500 + 3000,
      outputTokens: 150 + 80,
      cacheReadInputTokens: 12000 + 18000,
      cacheCreationInputTokens: 3000 + 0
    })
  })

  it('ends awaiting input: the assistant asked a question last', () => {
    expect(state.lastEventKind).toBe('assistant-message')
    expect(state.lastActivityAt).toBe(Date.parse('2026-07-01T10:01:00.000Z'))
    const justAfter = Date.parse('2026-07-01T10:01:30.000Z')
    expect(deriveStatus(state.lastEventKind, state.lastActivityAt, justAfter)).toBe(
      'awaiting-input'
    )
  })

  it('session-meta events do not count as activity', () => {
    const fresh = applyEvents(createSessionState(session), [
      { kind: 'session-meta', timestamp: null, title: 'T' }
    ])
    expect(fresh.lastEventKind).toBeNull()
    expect(fresh.lastActivityAt).toBeNull()
    expect(fresh.title).toBe('T')
  })

  it('session-meta model and cumulative usage set state, and snapshots replace rather than accumulate', () => {
    const snapshot = (inputTokens: number): AgentEvent => ({
      kind: 'session-meta',
      timestamp: null,
      cumulativeUsage: {
        inputTokens,
        outputTokens: 400,
        cacheReadInputTokens: 6000,
        cacheCreationInputTokens: 0
      }
    })
    const fresh = applyEvents(createSessionState(session), [
      { kind: 'session-meta', timestamp: null, model: 'gpt-5.3-codex' },
      snapshot(1000),
      snapshot(2000)
    ])
    expect(fresh.model).toBe('gpt-5.3-codex')
    expect(fresh.usage.inputTokens).toBe(2000) // latest snapshot wins; 1000 is not added
  })
})
