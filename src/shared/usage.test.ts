import { describe, expect, it } from 'vitest'
import type { SessionState } from './domain'
import { addUsage, aggregateUsage, EMPTY_USAGE, totalInputTokens, totalTokens } from './usage'

const usage = (
  inputTokens: number,
  outputTokens: number,
  cacheRead = 0,
  cacheCreation = 0
): SessionState['usage'] => ({
  inputTokens,
  outputTokens,
  cacheReadInputTokens: cacheRead,
  cacheCreationInputTokens: cacheCreation
})

describe('usage math', () => {
  it('adds component-wise', () => {
    expect(addUsage(usage(1, 2, 3, 4), usage(10, 20, 30, 40))).toEqual(usage(11, 22, 33, 44))
  })

  it('totals include cache traffic on the input side', () => {
    expect(totalInputTokens(usage(100, 5, 1000, 200))).toBe(1300)
    expect(totalTokens(usage(100, 5, 1000, 200))).toBe(1305)
  })

  it('aggregates across sessions (hand-computed)', () => {
    const states = [
      { usage: usage(2500, 150, 12000, 3000) },
      { usage: usage(3000, 80, 18000, 0) },
      { usage: EMPTY_USAGE }
    ] as SessionState[]
    expect(aggregateUsage(states)).toEqual(usage(5500, 230, 30000, 3000))
  })
})
