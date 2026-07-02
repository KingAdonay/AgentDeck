import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionKey, type SessionState } from '../../shared/domain'
import { ClaudeCodeAdapter } from '../agents/claude-code'
import { SessionService } from './service'

const line = (type: 'user' | 'assistant', text: string, timestamp: string): string =>
  JSON.stringify(
    type === 'user'
      ? {
          type,
          timestamp,
          cwd: '/Users/jane/dev/web-app',
          message: { role: 'user', content: text }
        }
      : {
          type,
          timestamp,
          message: {
            role: 'assistant',
            model: 'claude-opus-4-8',
            id: `msg_${timestamp}`,
            content: [{ type: 'text', text }]
          }
        }
  ) + '\n'

let root: string
let service: SessionService

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentdeck-service-'))
  mkdirSync(join(root, '-Users-jane-dev-webapp'))
  service = new SessionService([new ClaudeCodeAdapter(root)])
})

afterEach(async () => {
  await service.stop()
  rmSync(root, { recursive: true, force: true })
})

const KEY = sessionKey('claude-code', '-Users-jane-dev-webapp', 'aaa')

describe('SessionService', () => {
  it('replays existing transcripts into session state on start', async () => {
    writeFileSync(
      join(root, '-Users-jane-dev-webapp', 'aaa.jsonl'),
      line('user', 'hello', '2026-07-01T10:00:00.000Z') +
        line('assistant', 'hi, what shall we build?', '2026-07-01T10:00:05.000Z')
    )
    await service.start()

    await vi.waitFor(
      () => {
        const state = service.getSnapshot().find((s) => s.sessionId === 'aaa')
        expect(state?.userMessageCount).toBe(1)
        expect(state?.lastAssistantText).toBe('hi, what shall we build?')
        expect(state?.projectPath).toBe('/Users/jane/dev/web-app')
      },
      { timeout: 5000 }
    )
    expect(service.getEvents(KEY).map((e) => e.kind)).toEqual(['user-message', 'assistant-message'])
  })

  it('notifies listeners with updated state when a transcript grows', async () => {
    const file = join(root, '-Users-jane-dev-webapp', 'aaa.jsonl')
    writeFileSync(file, line('user', 'hello', '2026-07-01T10:00:00.000Z'))
    await service.start()
    await vi.waitFor(() => expect(service.getEvents(KEY)).toHaveLength(1), { timeout: 5000 })

    const updates: SessionState[][] = []
    service.onUpdate((sessions) => updates.push(sessions))
    appendFileSync(file, line('assistant', 'done!', '2026-07-01T10:00:10.000Z'))

    await vi.waitFor(() => expect(updates.length).toBeGreaterThan(0), { timeout: 5000 })
    const updated = updates.at(-1)?.[0]
    expect(updated?.lastAssistantText).toBe('done!')
    expect(updated?.lastEventKind).toBe('assistant-message')
  })

  it('tracks sessions created after start', async () => {
    await service.start()
    writeFileSync(
      join(root, '-Users-jane-dev-webapp', 'bbb.jsonl'),
      line('user', 'new session', '2026-07-01T11:00:00.000Z')
    )

    await vi.waitFor(
      () => expect(service.getSnapshot().some((s) => s.sessionId === 'bbb')).toBe(true),
      { timeout: 5000 }
    )
  })

  it('caps the per-session event buffer', async () => {
    const file = join(root, '-Users-jane-dev-webapp', 'aaa.jsonl')
    const many = Array.from({ length: 1200 }, (_, i) =>
      line('user', `msg ${i}`, '2026-07-01T10:00:00.000Z')
    ).join('')
    writeFileSync(file, many)
    await service.start()

    await vi.waitFor(() => expect(service.getEvents(KEY).length).toBeGreaterThan(0), {
      timeout: 5000
    })
    expect(service.getEvents(KEY).length).toBeLessThanOrEqual(1000)
    const snapshotState = service.getSnapshot().find((s) => s.sessionId === 'aaa')
    expect(snapshotState?.userMessageCount).toBe(1200) // state counts everything
  })
})
