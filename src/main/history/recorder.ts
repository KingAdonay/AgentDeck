import type { SessionState } from '../../shared/domain'
import { sessionKey } from '../../shared/domain'
import type { TaskRecord } from '../../shared/history'
import { toTaskRecord } from './record'

export interface HistoryRecorderDeps {
  /** Subscribe to session updates; returns an unsubscribe function. */
  onUpdate: (listener: (updated: SessionState[]) => void) => () => void
  write: (records: TaskRecord[]) => void
  flushIntervalMs?: number
}

/**
 * Batches session updates into the history store. Updates arrive in storms
 * (startup replay, active sessions), so the latest state per session is kept
 * in memory and written in one transaction per interval.
 */
export class HistoryRecorder {
  private readonly pending = new Map<string, SessionState>()
  private timer: NodeJS.Timeout | null = null
  private unsubscribe: (() => void) | null = null

  constructor(private readonly deps: HistoryRecorderDeps) {}

  start(): void {
    this.unsubscribe = this.deps.onUpdate((updated) => {
      for (const state of updated) {
        this.pending.set(sessionKey(state.agent, state.projectKey, state.sessionId), state)
      }
    })
    this.timer = setInterval(() => this.flush(), this.deps.flushIntervalMs ?? 5_000)
  }

  /** Write everything pending now. Safe to call at any time (e.g. on quit). */
  flush(): void {
    if (this.pending.size === 0) return
    const records = [...this.pending.values()]
      .map(toTaskRecord)
      .filter((record): record is TaskRecord => record !== null)
    this.pending.clear()
    try {
      this.deps.write(records)
    } catch (error) {
      console.error('[agentdeck] failed to record task history:', error)
    }
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.flush()
  }
}
