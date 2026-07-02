import { describe, expect, it } from 'vitest'
import type { SessionState } from '../../../shared/domain'
import { buildBoardView } from './boardView'

const NOW = Date.parse('2026-07-02T12:00:00.000Z')

function makeState(overrides: Partial<SessionState>): SessionState {
  return {
    agent: 'claude-code',
    sessionId: 'x',
    transcriptPath: '/t.jsonl',
    projectKey: '-p',
    projectPath: '/p/one',
    title: null,
    lastPrompt: null,
    lastAssistantText: null,
    model: null,
    gitBranch: null,
    lastEventKind: 'tool-call',
    firstActivityAt: NOW - 60_000,
    lastActivityAt: NOW - 5_000,
    userMessageCount: 1,
    toolCallCount: 0,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0
    },
    lastUsageMessageId: null,
    ...overrides
  }
}

const working = makeState({ sessionId: 'w' }) // tool-call 5s ago
const awaiting = makeState({ sessionId: 'a', lastEventKind: 'assistant-message' })
const doneBig = makeState({
  sessionId: 'd',
  projectPath: '/p/two',
  lastActivityAt: NOW - 3 * 60 * 60_000,
  usage: {
    inputTokens: 5000,
    outputTokens: 900,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0
  }
})

describe('buildBoardView', () => {
  it('filters by derived status', () => {
    const view = buildBoardView([working, awaiting, doneBig], NOW, 'working', 'activity')
    expect(view.flatMap((g) => g.sessions.map((s) => s.sessionId))).toEqual(['w'])

    const doneOnly = buildBoardView([working, awaiting, doneBig], NOW, 'done', 'activity')
    expect(doneOnly.flatMap((g) => g.sessions.map((s) => s.sessionId))).toEqual(['d'])
  })

  it('groups by project with usage rollups', () => {
    const view = buildBoardView([working, awaiting, doneBig], NOW, 'all', 'activity')
    expect(view).toHaveLength(2)
    expect(view[0]?.projectPath).toBe('/p/one') // most recent activity first
    expect(view[1]?.usage.inputTokens).toBe(5000)
  })

  it('sorts groups and sessions by tokens when asked', () => {
    const view = buildBoardView([working, awaiting, doneBig], NOW, 'all', 'tokens')
    expect(view[0]?.projectPath).toBe('/p/two') // 5900 tokens beats 0

    const mixed = buildBoardView(
      [
        working,
        makeState({
          sessionId: 'rich',
          usage: {
            inputTokens: 10,
            outputTokens: 1,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0
          }
        })
      ],
      NOW,
      'all',
      'tokens'
    )
    expect(mixed[0]?.sessions.map((s) => s.sessionId)).toEqual(['rich', 'w'])
  })
})
