import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaudeCodeAdapter } from '../agents/claude-code'
import { SessionWatcher, type SessionDelta } from './session-watcher'

const userLine = (text: string): string =>
  JSON.stringify({
    type: 'user',
    timestamp: new Date().toISOString(),
    message: { role: 'user', content: text }
  }) + '\n'

const toolCallLine = (): string =>
  JSON.stringify({
    type: 'assistant',
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      model: 'claude-opus-4-8',
      id: 'msg_x',
      content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }]
    }
  }) + '\n'

let root: string
let projectDir: string
let watcher: SessionWatcher
let deltas: SessionDelta[]

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentdeck-watch-'))
  projectDir = join(root, '-Users-jane-dev-webapp')
  mkdirSync(projectDir)
  deltas = []
  watcher = new SessionWatcher(new ClaudeCodeAdapter(root), { debounceMs: 20 })
  watcher.on('delta', (delta) => deltas.push(delta))
})

afterEach(async () => {
  await watcher.close()
  rmSync(root, { recursive: true, force: true })
})

describe('SessionWatcher', () => {
  it('emits a delta for transcripts that existed before start', async () => {
    const file = join(projectDir, 'aaa.jsonl')
    writeFileSync(file, userLine('hello') + toolCallLine())
    await watcher.start()

    await vi.waitFor(() => expect(deltas).toHaveLength(1), { timeout: 5000 })
    expect(deltas[0]).toMatchObject({
      agent: 'claude-code',
      sessionId: 'aaa',
      projectKey: '-Users-jane-dev-webapp',
      transcriptPath: file
    })
    expect(deltas[0]?.events.map((e) => e.kind)).toEqual(['user-message', 'tool-call'])
  })

  it('emits only the appended events on subsequent writes', async () => {
    const file = join(projectDir, 'bbb.jsonl')
    writeFileSync(file, userLine('first'))
    await watcher.start()
    await vi.waitFor(() => expect(deltas).toHaveLength(1), { timeout: 5000 })

    appendFileSync(file, toolCallLine())
    await vi.waitFor(() => expect(deltas).toHaveLength(2), { timeout: 5000 })
    expect(deltas[1]?.events.map((e) => e.kind)).toEqual(['tool-call'])
  })

  it('picks up sessions created after start', async () => {
    await watcher.start()
    writeFileSync(join(projectDir, 'ccc.jsonl'), userLine('new session'))

    await vi.waitFor(() => expect(deltas).toHaveLength(1), { timeout: 5000 })
    expect(deltas[0]?.sessionId).toBe('ccc')
  })

  it('ignores files that are not session transcripts', async () => {
    await watcher.start()
    writeFileSync(join(projectDir, 'notes.txt'), 'not a transcript')
    writeFileSync(join(root, 'stray.jsonl'), userLine('root-level stray'))

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(deltas).toHaveLength(0)
  })
})
