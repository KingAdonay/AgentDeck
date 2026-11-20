import type { FileEdit } from '../types'

const FILE_HEADER = /^\*\*\* (Add|Update|Delete) File: (.+)$/
const MOVE_HEADER = /^\*\*\* Move to: (.+)$/

/**
 * Count lines changed per file in a Codex `apply_patch` envelope:
 *
 *   *** Begin Patch
 *   *** Update File: src/a.ts
 *   @@ context
 *   -old
 *   +new
 *   *** End Patch
 *
 * Deleted files list no lines, so they count as touched with 0/0.
 */
export function parseApplyPatch(text: string): FileEdit[] {
  const edits: FileEdit[] = []
  let current: FileEdit | null = null
  for (const line of text.split('\n')) {
    const header = FILE_HEADER.exec(line)
    if (header?.[2] !== undefined) {
      current = { path: header[2].trim(), added: 0, removed: 0 }
      edits.push(current)
      continue
    }
    const move = MOVE_HEADER.exec(line)
    if (move?.[1] !== undefined && current) {
      current.path = move[1].trim()
      continue
    }
    if (current === null || line.startsWith('***')) continue
    if (line.startsWith('+')) current.added += 1
    else if (line.startsWith('-')) current.removed += 1
  }
  return edits
}

/** Pull patch text out of the shapes Codex uses to invoke apply_patch. */
export function extractPatchText(toolName: string, payloadInput: unknown): string | null {
  if (typeof payloadInput !== 'string') return null
  if (payloadInput.includes('*** Begin Patch')) {
    // custom_tool_call input is the raw patch; function_call arguments wrap it in JSON.
    if (toolName === 'apply_patch' && payloadInput.trimStart().startsWith('*** Begin Patch')) {
      return payloadInput
    }
    try {
      const parsed: unknown = JSON.parse(payloadInput)
      if (typeof parsed === 'object' && parsed !== null) {
        const record = parsed as Record<string, unknown>
        if (typeof record['input'] === 'string') return record['input']
        if (typeof record['patch'] === 'string') return record['patch']
        const command = record['command']
        if (Array.isArray(command)) {
          const patch = command.find(
            (part): part is string => typeof part === 'string' && part.includes('*** Begin Patch')
          )
          if (patch !== undefined) return patch.slice(patch.indexOf('*** Begin Patch'))
        }
        if (typeof command === 'string') return command.slice(command.indexOf('*** Begin Patch'))
      }
    } catch {
      return payloadInput.slice(payloadInput.indexOf('*** Begin Patch'))
    }
  }
  return null
}
