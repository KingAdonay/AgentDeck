import { describe, expect, it } from 'vitest'
import type { AgentEventKind, SessionStatus } from './domain'
import { DEFAULT_THRESHOLDS, deriveStatus } from './status'

const NOW = Date.parse('2026-07-02T12:00:00.000Z')
const seconds = (n: number): number => n * 1000
const minutes = (n: number): number => n * 60_000

describe('deriveStatus', () => {
  const cases: Array<{
    name: string
    lastEventKind: AgentEventKind | null
    age: number | null
    expected: SessionStatus
  }> = [
    { name: 'no events at all', lastEventKind: null, age: null, expected: 'idle' },
    {
      name: 'user just prompted',
      lastEventKind: 'user-message',
      age: seconds(5),
      expected: 'working'
    },
    {
      name: 'tool call in flight',
      lastEventKind: 'tool-call',
      age: seconds(30),
      expected: 'working'
    },
    {
      name: 'tool result just landed',
      lastEventKind: 'tool-result',
      age: seconds(2),
      expected: 'working'
    },
    { name: 'mid-turn but stalled', lastEventKind: 'tool-call', age: minutes(5), expected: 'idle' },
    {
      name: 'user prompt never answered',
      lastEventKind: 'user-message',
      age: minutes(10),
      expected: 'idle'
    },
    {
      name: 'assistant just replied',
      lastEventKind: 'assistant-message',
      age: seconds(5),
      expected: 'awaiting-input'
    },
    {
      name: 'assistant replied a while ago',
      lastEventKind: 'assistant-message',
      age: minutes(59),
      expected: 'awaiting-input'
    },
    {
      name: 'assistant reply long forgotten',
      lastEventKind: 'assistant-message',
      age: minutes(120),
      expected: 'done'
    },
    {
      name: 'abandoned mid-turn long ago',
      lastEventKind: 'tool-call',
      age: minutes(120),
      expected: 'done'
    }
  ]

  it.each(cases)('$name → $expected', ({ lastEventKind, age, expected }) => {
    const lastActivityAt = age === null ? null : NOW - age
    expect(deriveStatus(lastEventKind, lastActivityAt, NOW)).toBe(expected)
  })

  it('respects custom thresholds', () => {
    const thresholds = { workingStaleMs: seconds(10), doneAfterMs: minutes(1) }
    expect(deriveStatus('tool-call', NOW - seconds(20), NOW, thresholds)).toBe('idle')
    expect(deriveStatus('assistant-message', NOW - minutes(2), NOW, thresholds)).toBe('done')
  })

  it('exports sane defaults (working staleness < done threshold)', () => {
    expect(DEFAULT_THRESHOLDS.workingStaleMs).toBeLessThan(DEFAULT_THRESHOLDS.doneAfterMs)
  })
})
