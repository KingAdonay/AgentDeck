import { describe, expect, it } from 'vitest'
import { parseClaudeLine, parseFileEdit } from './parse'

function toolResultLine(toolUseResult: unknown, isError = false): string {
  return JSON.stringify({
    type: 'user',
    timestamp: '2026-07-01T10:00:06.500Z',
    message: {
      role: 'user',
      content: [{ tool_use_id: 'toolu_1', type: 'tool_result', content: 'ok', is_error: isError }]
    },
    toolUseResult
  })
}

const EDIT_RESULT = {
  filePath: '/repo/src/app.ts',
  oldString: 'a',
  newString: 'b',
  structuredPatch: [
    { oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [' x', '-a', '+b', '+c'] },
    { oldStart: 9, oldLines: 1, newStart: 10, newLines: 0, lines: ['-gone'] }
  ]
}

describe('parseFileEdit', () => {
  it('counts +/- lines across structuredPatch hunks', () => {
    expect(parseFileEdit(EDIT_RESULT)).toEqual({ path: '/repo/src/app.ts', added: 2, removed: 2 })
  })

  it('counts a created file’s content as added lines', () => {
    expect(
      parseFileEdit({
        type: 'create',
        filePath: '/repo/new.ts',
        content: 'one\ntwo\nthree\n',
        structuredPatch: []
      })
    ).toEqual({ path: '/repo/new.ts', added: 3, removed: 0 })
  })

  it('ignores results that are not file edits', () => {
    expect(parseFileEdit({ stdout: 'hi', stderr: '' })).toBeNull()
    expect(parseFileEdit('Error: file not found')).toBeNull()
    expect(parseFileEdit({ filePath: '/x', structuredPatch: [] })).toBeNull()
  })
})

describe('parseClaudeLine with edit results', () => {
  it('attaches the edit to the tool-result event', () => {
    expect(parseClaudeLine(toolResultLine(EDIT_RESULT))).toEqual([
      {
        kind: 'tool-result',
        timestamp: Date.parse('2026-07-01T10:00:06.500Z'),
        isError: false,
        edits: [{ path: '/repo/src/app.ts', added: 2, removed: 2 }]
      }
    ])
  })

  it('drops edits from failed tool results', () => {
    const [event] = parseClaudeLine(toolResultLine(EDIT_RESULT, true))
    expect(event).toEqual({
      kind: 'tool-result',
      timestamp: Date.parse('2026-07-01T10:00:06.500Z'),
      isError: true
    })
  })
})
