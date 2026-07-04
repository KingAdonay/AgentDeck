import { describe, expect, it } from 'vitest'
import { formatDuration, formatTokens, relativeTime, shortenPath, shortModel } from './format'

const NOW = 1_750_000_000_000

describe('relativeTime', () => {
  it('returns a dash for null timestamps', () => {
    expect(relativeTime(null, NOW)).toBe('—')
  })

  it('formats seconds under a minute', () => {
    expect(relativeTime(NOW, NOW)).toBe('0s ago')
    expect(relativeTime(NOW - 59_000, NOW)).toBe('59s ago')
  })

  it('clamps future timestamps to zero', () => {
    expect(relativeTime(NOW + 5_000, NOW)).toBe('0s ago')
  })

  it('formats minutes under an hour', () => {
    expect(relativeTime(NOW - 60_000, NOW)).toBe('1m ago')
    expect(relativeTime(NOW - 59 * 60_000, NOW)).toBe('59m ago')
  })

  it('formats hours under a day', () => {
    expect(relativeTime(NOW - 60 * 60_000, NOW)).toBe('1h ago')
    expect(relativeTime(NOW - 23 * 60 * 60_000, NOW)).toBe('23h ago')
  })

  it('formats days beyond 24 hours', () => {
    expect(relativeTime(NOW - 24 * 60 * 60_000, NOW)).toBe('1d ago')
    expect(relativeTime(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe('3d ago')
  })
})

describe('shortenPath', () => {
  it('keeps the last two segments', () => {
    expect(shortenPath('/Users/jane/dev/web-app')).toBe('dev/web-app')
  })

  it('returns a single segment as-is', () => {
    expect(shortenPath('/web-app')).toBe('web-app')
    expect(shortenPath('web-app')).toBe('web-app')
  })

  it('ignores trailing slashes', () => {
    expect(shortenPath('/Users/jane/dev/web-app/')).toBe('dev/web-app')
  })

  it('falls back to the original path when there are no segments', () => {
    expect(shortenPath('')).toBe('')
    expect(shortenPath('/')).toBe('/')
  })
})

describe('shortModel', () => {
  it('strips the claude- prefix', () => {
    expect(shortModel('claude-opus-4-8')).toBe('opus-4-8')
  })

  it('leaves other models untouched', () => {
    expect(shortModel('gpt-5-codex')).toBe('gpt-5-codex')
  })

  it('only strips the prefix once and only at the start', () => {
    expect(shortModel('claude-claude-test')).toBe('claude-test')
    expect(shortModel('not-claude-model')).toBe('not-claude-model')
  })
})

describe('formatTokens', () => {
  it('shows small counts verbatim', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(999)).toBe('999')
  })

  it('shows one decimal below 10k', () => {
    expect(formatTokens(1000)).toBe('1.0k')
    expect(formatTokens(1234)).toBe('1.2k')
    expect(formatTokens(9999)).toBe('10.0k')
  })

  it('drops the decimal from 10k up to 1M', () => {
    expect(formatTokens(10_000)).toBe('10k')
    expect(formatTokens(999_499)).toBe('999k')
  })

  it('formats millions with one decimal', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M')
    expect(formatTokens(2_450_000)).toBe('2.5M')
  })
})

describe('formatDuration', () => {
  it('returns null when either bound is missing', () => {
    expect(formatDuration(null, NOW)).toBeNull()
    expect(formatDuration(NOW, null)).toBeNull()
  })

  it('returns null when the range is empty or inverted', () => {
    expect(formatDuration(NOW, NOW)).toBeNull()
    expect(formatDuration(NOW, NOW - 1)).toBeNull()
  })

  it('formats sub-minute durations as <1m', () => {
    expect(formatDuration(NOW, NOW + 29_000)).toBe('<1m')
  })

  it('formats minutes under an hour', () => {
    expect(formatDuration(NOW, NOW + 60_000)).toBe('1m')
    expect(formatDuration(NOW, NOW + 59 * 60_000)).toBe('59m')
  })

  it('formats hours with a minute remainder', () => {
    expect(formatDuration(NOW, NOW + 60 * 60_000)).toBe('1h 0m')
    expect(formatDuration(NOW, NOW + 125 * 60_000)).toBe('2h 5m')
  })
})
