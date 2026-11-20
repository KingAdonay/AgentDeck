import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSession } from '../agents/types'
import type { SessionState } from '../../shared/domain'
import { HIGHLIGHT_MAX_CHARS, type TaskRecord } from '../../shared/history'
import { applyEvents, createSessionState } from '../sessions/reduce'
import { toHighlight, toTaskRecord } from './record'
import { HistoryRecorder } from './recorder'
import { HistoryStore } from './store'

const session: AgentSession = {
  agent: 'claude-code',
  sessionId: 's1',
  transcriptPath: '/t.jsonl',
  projectKey: '-repo',
  projectPathGuess: '/repo',
  lastModifiedAt: 0,
  sizeBytes: 0
}

const T0 = Date.parse('2026-07-01T10:00:00.000Z')

function activeState(): SessionState {
  return applyEvents(createSessionState(session), [
    { kind: 'user-message', timestamp: T0, text: '  Add   dark\nmode  ', cwd: '/repo' },
    {
      kind: 'tool-result',
      timestamp: T0 + 1000,
      isError: false,
      edits: [{ path: '/repo/a.ts', added: 10, removed: 2 }]
    },
    {
      kind: 'tool-result',
      timestamp: T0 + 2000,
      isError: false,
      edits: [{ path: '/repo/a.ts', added: 1, removed: 1 }]
    },
    {
      kind: 'tool-call',
      timestamp: T0 + 3000,
      toolName: 'apply_patch',
      edits: [{ path: '/repo/b.ts', added: 4, removed: 0 }]
    },
    { kind: 'user-message', timestamp: T0 + 4000, text: 'now tests' },
    { kind: 'session-meta', timestamp: null, title: 'Dark mode' }
  ])
}

function record(overrides: Partial<TaskRecord>): TaskRecord {
  const base = toTaskRecord(activeState())
  if (base === null) throw new Error('expected a record')
  return { ...base, ...overrides }
}

describe('reducer edit + first-prompt tracking', () => {
  it('keeps the first prompt, sums lines, and dedupes touched files', () => {
    const state = activeState()
    expect(state.firstPrompt).toBe('  Add   dark\nmode  ')
    expect(state.lastPrompt).toBe('now tests')
    expect(state.linesAdded).toBe(15)
    expect(state.linesRemoved).toBe(3)
    expect(state.filesTouched).toEqual(['/repo/a.ts', '/repo/b.ts'])
  })
})

describe('toTaskRecord', () => {
  it('returns null before any activity', () => {
    expect(toTaskRecord(createSessionState(session))).toBeNull()
  })

  it('maps metadata only, with a collapsed highlight', () => {
    expect(toTaskRecord(activeState())).toMatchObject({
      key: 'claude-code:-repo:s1',
      title: 'Dark mode',
      highlight: 'Add dark mode',
      projectPath: '/repo',
      startedAt: T0,
      lastActivityAt: T0 + 4000,
      userMessageCount: 2,
      linesAdded: 15,
      linesRemoved: 3,
      filesChanged: 2
    })
  })

  it('truncates long highlights', () => {
    const highlight = toHighlight('word '.repeat(200))
    expect(highlight).toHaveLength(HIGHLIGHT_MAX_CHARS)
    expect(highlight?.endsWith('…')).toBe(true)
    expect(toHighlight('   ')).toBeNull()
  })
})

describe('HistoryStore', () => {
  let dir: string
  let store: HistoryStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agentdeck-history-'))
    store = new HistoryStore(join(dir, 'nested', 'history.sqlite'))
  })

  afterEach(() => {
    store.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('migrates a fresh database to the latest schema', () => {
    expect(store.schemaVersion).toBe(1)
    expect(store.list()).toEqual({ tasks: [], total: 0 })
  })

  it('round-trips records and survives reopening', () => {
    const original = record({})
    store.upsertMany([original])
    store.close()
    store = new HistoryStore(join(dir, 'nested', 'history.sqlite'))
    expect(store.list().tasks).toEqual([original])
  })

  it('updates in place and never lets an older snapshot overwrite a newer one', () => {
    store.upsertMany([record({ linesAdded: 15 })])
    store.upsertMany([record({ linesAdded: 99, lastActivityAt: T0 + 9000 })])
    store.upsertMany([record({ linesAdded: 1, lastActivityAt: T0 })])
    const { tasks, total } = store.list()
    expect(total).toBe(1)
    expect(tasks[0]).toMatchObject({ linesAdded: 99, lastActivityAt: T0 + 9000 })
  })

  it('filters by agent, date, and search, newest first, with paging', () => {
    store.upsertMany([
      record({ key: 'a', title: 'Fix login', lastActivityAt: T0 }),
      record({
        key: 'b',
        agent: 'codex-cli',
        title: null,
        highlight: 'refactor 100% of utils',
        lastActivityAt: T0 + 1
      }),
      record({ key: 'c', title: 'Docs', gitBranch: 'feature/login', lastActivityAt: T0 + 2 })
    ])
    expect(store.list().tasks.map((task) => task.key)).toEqual(['c', 'b', 'a'])
    expect(store.list({ agent: 'codex-cli' }).tasks.map((task) => task.key)).toEqual(['b'])
    expect(store.list({ since: T0 + 1 }).total).toBe(2)
    expect(store.list({ search: 'LOGIN' }).tasks.map((task) => task.key)).toEqual(['c', 'a'])
    // LIKE wildcards in the search text are matched literally.
    expect(store.list({ search: '100%' }).tasks.map((task) => task.key)).toEqual(['b'])
    expect(store.list({ search: '_' }).total).toBe(0)
    const page = store.list({ limit: 1, offset: 1 })
    expect(page).toMatchObject({ total: 3 })
    expect(page.tasks.map((task) => task.key)).toEqual(['b'])
  })
})

describe('HistoryRecorder', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('batches the latest state per session and flushes on an interval and on stop', () => {
    vi.useFakeTimers()
    let emit: (updated: SessionState[]) => void = () => undefined
    const writes: TaskRecord[][] = []
    const recorder = new HistoryRecorder({
      onUpdate: (listener) => {
        emit = listener
        return () => undefined
      },
      write: (records) => writes.push(records),
      flushIntervalMs: 1000
    })
    recorder.start()

    const state = activeState()
    emit([createSessionState(session)]) // no activity yet → skipped
    emit([state])
    emit([{ ...state, linesAdded: 42 }])
    expect(writes).toHaveLength(0)

    vi.advanceTimersByTime(1000)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toHaveLength(1)
    expect(writes[0]?.[0]?.linesAdded).toBe(42)

    vi.advanceTimersByTime(5000)
    expect(writes).toHaveLength(1) // nothing pending → no empty writes

    emit([state])
    recorder.stop()
    expect(writes).toHaveLength(2)
  })

  it('logs and carries on when a write fails', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let emit: (updated: SessionState[]) => void = () => undefined
    const recorder = new HistoryRecorder({
      onUpdate: (listener) => {
        emit = listener
        return () => undefined
      },
      write: () => {
        throw new Error('disk full')
      }
    })
    recorder.start()
    emit([activeState()])
    expect(() => recorder.stop()).not.toThrow()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
