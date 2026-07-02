import { describe, expect, it, vi } from 'vitest'
import type { SessionState } from '../../shared/domain'
import { buildTrayMenuTemplate, trayTooltip, type TrayHandlers } from './menu'

const NOW = Date.parse('2026-07-02T12:00:00.000Z')

function makeState(overrides: Partial<SessionState>): SessionState {
  return {
    agent: 'claude-code',
    sessionId: 's1',
    transcriptPath: '/t.jsonl',
    projectKey: '-p',
    projectPath: '/Users/jane/dev/web-app',
    title: 'Fix the login flow',
    lastPrompt: null,
    lastAssistantText: null,
    model: null,
    gitBranch: null,
    lastEventKind: 'tool-call',
    firstActivityAt: NOW - 60_000,
    lastActivityAt: NOW - 5_000,
    userMessageCount: 1,
    toolCallCount: 2,
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

function makeHandlers(): TrayHandlers {
  return { reveal: vi.fn(), openApp: vi.fn(), quit: vi.fn() }
}

describe('trayTooltip', () => {
  it('summarizes working and awaiting counts', () => {
    const states = [
      makeState({}), // working (tool-call 5s ago)
      makeState({ sessionId: 's2', lastEventKind: 'assistant-message' }), // awaiting-input
      makeState({ sessionId: 's3', lastActivityAt: NOW - 2 * 60 * 60_000 }) // done
    ]
    expect(trayTooltip(states, NOW)).toBe('AgentDeck — 1 working · 1 need input')
  })
})

describe('buildTrayMenuTemplate', () => {
  it('lists recent sessions with status, most recent first, capped at 5', () => {
    const states = Array.from({ length: 7 }, (_, i) =>
      makeState({
        sessionId: `s${i}`,
        title: `Session number ${i}`,
        lastActivityAt: NOW - i * 60_000
      })
    )
    const template = buildTrayMenuTemplate(states, NOW, makeHandlers())
    const sessionLabels = template
      .filter((item) => item.label?.includes('Session number'))
      .map((item) => item.label)

    expect(sessionLabels).toHaveLength(5)
    expect(sessionLabels[0]).toBe('Session number 0 — working')
  })

  it('starts with a disabled summary line and ends with Open/Quit', () => {
    const template = buildTrayMenuTemplate([makeState({})], NOW, makeHandlers())
    expect(template[0]).toMatchObject({ label: '1 working · 0 need input', enabled: false })
    expect(template.at(-2)?.label).toBe('Open AgentDeck')
    expect(template.at(-1)?.label).toBe('Quit AgentDeck')
  })

  it('clicking a session reveals it by key', () => {
    const handlers = makeHandlers()
    const template = buildTrayMenuTemplate([makeState({})], NOW, handlers)
    const item = template.find((i) => i.label?.startsWith('Fix the login flow'))
    ;(item?.click as () => void)()
    expect(handlers.reveal).toHaveBeenCalledWith('claude-code:-p:s1')
  })

  it('shows a placeholder when there are no sessions', () => {
    const template = buildTrayMenuTemplate([], NOW, makeHandlers())
    expect(template.some((i) => i.label === 'No sessions yet' && i.enabled === false)).toBe(true)
  })

  it('truncates very long titles', () => {
    const template = buildTrayMenuTemplate(
      [makeState({ title: 'A'.repeat(80) })],
      NOW,
      makeHandlers()
    )
    const item = template.find((i) => i.label?.startsWith('AAA'))
    expect(item?.label?.length).toBeLessThan(60)
    expect(item?.label).toContain('…')
  })
})
