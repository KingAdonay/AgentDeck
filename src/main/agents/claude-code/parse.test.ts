import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseClaudeLine } from './parse'

const richFixture = join(
  __dirname,
  '__fixtures__',
  'projects',
  '-Users-jane-dev-webapp',
  '11111111-1111-1111-1111-111111111111.jsonl'
)

function parseFixture(): ReturnType<typeof parseClaudeLine> {
  return readFileSync(richFixture, 'utf8')
    .split('\n')
    .flatMap((line) => parseClaudeLine(line))
}

describe('parseClaudeLine on the rich fixture', () => {
  const events = parseFixture()

  it('produces the expected normalized event sequence', () => {
    expect(events.map((e) => e.kind)).toEqual([
      'user-message',
      'assistant-message',
      'tool-call',
      'tool-result',
      'session-meta',
      'session-meta',
      'assistant-message'
    ])
  })

  it('extracts the human prompt with workspace context', () => {
    const [first] = events
    expect(first).toMatchObject({
      kind: 'user-message',
      text: 'Add a dark mode toggle to the settings page',
      cwd: '/Users/jane/dev/web-app',
      gitBranch: 'feature/dark-mode'
    })
    expect(first?.timestamp).toBe(Date.parse('2026-07-01T10:00:01.000Z'))
  })

  it('extracts assistant text with model, messageId, and usage', () => {
    const assistant = events.find((e) => e.kind === 'assistant-message')
    expect(assistant).toMatchObject({
      model: 'claude-opus-4-8',
      messageId: 'msg_aaa',
      usage: {
        inputTokens: 2500,
        outputTokens: 150,
        cacheReadInputTokens: 12000,
        cacheCreationInputTokens: 3000
      }
    })
  })

  it('extracts tool calls with name and description input', () => {
    const call = events.find((e) => e.kind === 'tool-call')
    expect(call).toMatchObject({ toolName: 'Read', messageId: 'msg_aaa' })
  })

  it('extracts session metadata (title, last prompt)', () => {
    const metas = events.filter((e) => e.kind === 'session-meta')
    expect(metas).toEqual([
      { kind: 'session-meta', timestamp: null, title: 'Add dark mode toggle' },
      {
        kind: 'session-meta',
        timestamp: null,
        lastPrompt: 'Add a dark mode toggle to the settings page'
      }
    ])
  })

  it('drops sidechain entries, injected IDE context, snapshots, and unknown types', () => {
    const texts = events
      .filter((e) => e.kind === 'assistant-message' || e.kind === 'user-message')
      .map((e) => e.text)
    expect(texts.join(' ')).not.toContain('Sidechain')
    expect(texts.join(' ')).not.toContain('ide_opened_file')
  })
})

describe('parseClaudeLine robustness', () => {
  it('never throws on garbage', () => {
    expect(parseClaudeLine('not json {{{')).toEqual([])
    expect(parseClaudeLine('')).toEqual([])
    expect(parseClaudeLine('   ')).toEqual([])
    expect(parseClaudeLine('42')).toEqual([])
    expect(parseClaudeLine('"a string"')).toEqual([])
    expect(parseClaudeLine('[1,2,3]')).toEqual([])
    expect(parseClaudeLine('{"type":"user"}')).toEqual([])
    expect(parseClaudeLine('{"type":"assistant","message":{"content":"weird"}}')).toEqual([])
  })

  it('flags failed tool results', () => {
    const [event] = parseClaudeLine(
      JSON.stringify({
        type: 'user',
        timestamp: '2026-07-01T10:00:00.000Z',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'boom', is_error: true }]
        }
      })
    )
    expect(event).toMatchObject({ kind: 'tool-result', isError: true })
  })

  it('treats a missing timestamp as null rather than dropping the event', () => {
    const [event] = parseClaudeLine(
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello' } })
    )
    expect(event).toMatchObject({ kind: 'user-message', text: 'hello', timestamp: null })
  })
})
