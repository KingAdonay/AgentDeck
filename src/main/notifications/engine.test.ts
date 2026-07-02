import { describe, expect, it } from 'vitest'
import type { SessionState, SessionStatus } from '../../shared/domain'
import { sessionKey } from '../../shared/domain'
import { DEFAULT_SETTINGS } from '../settings/store'
import { computeTransitions, notificationsFor, type StatusTransition } from './engine'

const NOW = Date.parse('2026-07-02T12:00:00.000Z')

function makeState(overrides: Partial<SessionState>): SessionState {
  return {
    agent: 'claude-code',
    sessionId: 's1',
    transcriptPath: '/t.jsonl',
    projectKey: '-Users-jane-dev-webapp',
    projectPath: '/Users/jane/dev/web-app',
    title: 'Fix the login flow',
    lastPrompt: null,
    lastAssistantText: null,
    model: null,
    gitBranch: null,
    lastEventKind: 'assistant-message',
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

const KEY = sessionKey('claude-code', '-Users-jane-dev-webapp', 's1')

describe('computeTransitions', () => {
  it('produces no transitions on first sight (startup replay must not notify)', () => {
    const { transitions, statuses } = computeTransitions(new Map(), [makeState({})], NOW)
    expect(transitions).toEqual([])
    expect(statuses.get(KEY)).toBe('awaiting-input')
  })

  it('detects a status change', () => {
    const previous = new Map<string, SessionStatus>([[KEY, 'working']])
    const { transitions } = computeTransitions(previous, [makeState({})], NOW)
    expect(transitions).toEqual([
      expect.objectContaining({ key: KEY, from: 'working', to: 'awaiting-input' })
    ])
  })

  it('is silent while the status is unchanged', () => {
    const previous = new Map<string, SessionStatus>([[KEY, 'awaiting-input']])
    expect(computeTransitions(previous, [makeState({})], NOW).transitions).toEqual([])
  })

  it('detects pure time-decay transitions (working → idle with no new events)', () => {
    const previous = new Map<string, SessionStatus>([[KEY, 'working']])
    const stalled = makeState({ lastEventKind: 'tool-call', lastActivityAt: NOW - 10 * 60_000 })
    const { transitions } = computeTransitions(previous, [stalled], NOW)
    expect(transitions).toEqual([expect.objectContaining({ from: 'working', to: 'idle' })])
  })
})

describe('notificationsFor', () => {
  const t = (from: SessionStatus, to: SessionStatus): StatusTransition => ({
    key: KEY,
    state: makeState({}),
    from,
    to
  })

  it('notifies on → awaiting-input by default, with title and project in the body', () => {
    const specs = notificationsFor([t('working', 'awaiting-input')], DEFAULT_SETTINGS.notifications)
    expect(specs).toEqual([
      { sessionKey: KEY, title: 'Fix the login flow', body: 'Needs your input · dev/web-app' }
    ])
  })

  it('stays quiet for stalls and done by default', () => {
    const transitions = [t('working', 'idle'), t('awaiting-input', 'done')]
    expect(notificationsFor(transitions, DEFAULT_SETTINGS.notifications)).toEqual([])
  })

  it('honors opt-ins for stalled and done', () => {
    const prefs = { awaitingInput: false, stalled: true, done: true }
    const specs = notificationsFor(
      [t('working', 'idle'), t('awaiting-input', 'done'), t('working', 'awaiting-input')],
      prefs
    )
    expect(specs.map((s) => s.body)).toEqual([
      'May have stalled mid-turn · dev/web-app',
      'Session finished · dev/web-app'
    ])
  })

  it('does not treat idle-from-user-message as a stall', () => {
    // 'stalled' means the agent went quiet mid-turn, i.e. from 'working' only.
    const specs = notificationsFor([t('idle', 'idle'), t('awaiting-input', 'idle')], {
      awaitingInput: true,
      stalled: true,
      done: false
    })
    expect(specs).toEqual([])
  })

  it('falls back to prompt or session id when there is no title', () => {
    const untitled: StatusTransition = {
      key: KEY,
      state: makeState({ title: null, lastPrompt: null, sessionId: 'abcdef123456' }),
      from: 'working',
      to: 'awaiting-input'
    }
    expect(notificationsFor([untitled], DEFAULT_SETTINGS.notifications)[0]?.title).toBe(
      'Session abcdef12'
    )
  })
})
