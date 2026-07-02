import type { AgentEvent, SessionState } from '../../shared/domain'
import { sessionKey } from '../../shared/domain'
import type { AgentAdapter } from '../agents/types'
import { SessionWatcher, type SessionDelta } from '../watchers/session-watcher'
import { applyEvents, createSessionState } from './reduce'

/** Keep enough events for a useful timeline without unbounded memory. */
const MAX_EVENTS_PER_SESSION = 1000

/**
 * The single source of truth for session state in the main process.
 * Discovery seeds empty states; the watcher's initial scan replays every
 * transcript through the reducer, and appends stream in as deltas.
 */
export class SessionService {
  private readonly states = new Map<string, SessionState>()
  private readonly events = new Map<string, AgentEvent[]>()
  private readonly watchers: SessionWatcher[] = []
  private readonly listeners = new Set<(updated: SessionState[]) => void>()

  constructor(private readonly adapters: AgentAdapter[]) {}

  async start(): Promise<void> {
    for (const adapter of this.adapters) {
      for (const session of await adapter.discoverSessions()) {
        const key = sessionKey(session.agent, session.projectKey, session.sessionId)
        if (!this.states.has(key)) this.states.set(key, createSessionState(session))
      }
      const watcher = new SessionWatcher(adapter)
      watcher.on('delta', (delta) => this.applyDelta(delta))
      watcher.on('error', (error) => {
        console.error('[agentdeck] watcher error, state may lag:', error)
      })
      this.watchers.push(watcher)
      await watcher.start()
    }
  }

  async stop(): Promise<void> {
    await Promise.all(this.watchers.map((watcher) => watcher.close()))
    this.watchers.length = 0
  }

  getSnapshot(): SessionState[] {
    return [...this.states.values()]
  }

  getEvents(key: string): AgentEvent[] {
    return this.events.get(key) ?? []
  }

  /** Returns an unsubscribe function. */
  onUpdate(listener: (updated: SessionState[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private applyDelta(delta: SessionDelta): void {
    const key = sessionKey(delta.agent, delta.projectKey, delta.sessionId)
    const existing =
      this.states.get(key) ??
      createSessionState({
        agent: delta.agent,
        sessionId: delta.sessionId,
        transcriptPath: delta.transcriptPath,
        projectKey: delta.projectKey,
        // Placeholder until the first event carrying a cwd arrives.
        projectPathGuess: delta.projectKey,
        lastModifiedAt: Date.now(),
        sizeBytes: 0
      })

    const next = applyEvents(existing, delta.events)
    this.states.set(key, next)

    const buffer = this.events.get(key) ?? []
    buffer.push(...delta.events)
    if (buffer.length > MAX_EVENTS_PER_SESSION) {
      buffer.splice(0, buffer.length - MAX_EVENTS_PER_SESSION)
    }
    this.events.set(key, buffer)

    for (const listener of this.listeners) listener([next])
  }
}
