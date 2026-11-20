import { describe, expect, it } from 'vitest'
import { isInjectedContent } from './text'

describe('isInjectedContent', () => {
  it('flags tag-wrapped context and Codex AGENTS.md injections', () => {
    expect(isInjectedContent('<environment_context>\n  <cwd>/x</cwd>')).toBe(true)
    expect(isInjectedContent('# AGENTS.md instructions for /repo\n\n<INSTRUCTIONS>')).toBe(true)
  })

  it('keeps what the human typed', () => {
    expect(isInjectedContent('Audit the app for bugs')).toBe(false)
    expect(isInjectedContent('# Plan\nrefactor AGENTS.md handling')).toBe(false)
    expect(isInjectedContent('use a <div> here')).toBe(false)
  })
})
