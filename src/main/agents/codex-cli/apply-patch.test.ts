import { describe, expect, it } from 'vitest'
import { parseCodexLine } from './parse'
import { extractPatchText, parseApplyPatch } from './apply-patch'

const PATCH = [
  '*** Begin Patch',
  '*** Update File: src/app.ts',
  '@@ function main()',
  ' const a = 1',
  '-const b = 2',
  '+const b = 3',
  '+const c = 4',
  '*** Add File: src/new.ts',
  '+export const x = 1',
  '+export const y = 2',
  '*** Delete File: src/old.ts',
  '*** Update File: src/rename-me.ts',
  '*** Move to: src/renamed.ts',
  '@@',
  '-// old',
  '+// new',
  '*** End of File',
  '*** End Patch'
].join('\n')

describe('parseApplyPatch', () => {
  it('counts added and removed lines per file, including adds, deletes, and moves', () => {
    expect(parseApplyPatch(PATCH)).toEqual([
      { path: 'src/app.ts', added: 2, removed: 1 },
      { path: 'src/new.ts', added: 2, removed: 0 },
      { path: 'src/old.ts', added: 0, removed: 0 },
      { path: 'src/renamed.ts', added: 1, removed: 1 }
    ])
  })

  it('returns nothing for text that is not a patch', () => {
    expect(parseApplyPatch('+not a patch\n-really')).toEqual([])
  })
})

describe('extractPatchText', () => {
  it('takes custom_tool_call input as the raw patch', () => {
    expect(extractPatchText('apply_patch', PATCH)).toBe(PATCH)
  })

  it('unwraps function_call JSON arguments', () => {
    expect(extractPatchText('apply_patch', JSON.stringify({ input: PATCH }))).toBe(PATCH)
    expect(extractPatchText('shell', JSON.stringify({ command: ['apply_patch', PATCH] }))).toBe(
      PATCH
    )
  })

  it('ignores tool calls without a patch', () => {
    expect(extractPatchText('shell', JSON.stringify({ command: ['ls'] }))).toBeNull()
    expect(extractPatchText('apply_patch', undefined)).toBeNull()
  })
})

describe('parseCodexLine with apply_patch', () => {
  it('attaches edits to a custom_tool_call and keeps the description short', () => {
    const line = JSON.stringify({
      timestamp: '2026-07-01T09:00:10.000Z',
      type: 'response_item',
      payload: { type: 'custom_tool_call', name: 'apply_patch', input: PATCH }
    })
    const [event] = parseCodexLine(line)
    expect(event).toMatchObject({ kind: 'tool-call', toolName: 'apply_patch' })
    expect(event?.kind === 'tool-call' && event.description).toBe('apply_patch')
    expect(event?.kind === 'tool-call' && event.edits).toHaveLength(4)
  })

  it('attaches edits to a function_call', () => {
    const line = JSON.stringify({
      timestamp: '2026-07-01T09:00:10.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'apply_patch',
        arguments: JSON.stringify({ input: PATCH })
      }
    })
    const [event] = parseCodexLine(line)
    expect(event?.kind === 'tool-call' && event.edits?.[0]).toEqual({
      path: 'src/app.ts',
      added: 2,
      removed: 1
    })
  })
})
