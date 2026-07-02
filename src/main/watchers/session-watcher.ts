import { EventEmitter } from 'node:events'
import { watch, type FSWatcher } from 'chokidar'
import type { AgentAdapter, AgentEvent, AgentKind } from '../agents/types'
import { JsonlTailer } from './jsonl-tailer'

/** New events observed on one session's transcript. */
export interface SessionDelta {
  agent: AgentKind
  sessionId: string
  projectKey: string
  transcriptPath: string
  events: AgentEvent[]
}

export interface SessionWatcherOptions {
  /** Coalesce rapid appends to the same file before reading. */
  debounceMs?: number
}

export interface SessionWatcher {
  on(event: 'delta', listener: (delta: SessionDelta) => void): this
  on(event: 'error', listener: (error: unknown) => void): this
}

/**
 * Watches an adapter's roots and turns transcript appends into SessionDeltas:
 * chokidar add/change → per-file debounce → JsonlTailer (only new bytes) →
 * adapter.parseLine → emit('delta').
 */
export class SessionWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private readonly tailers = new Map<string, JsonlTailer>()
  private readonly pending = new Map<string, NodeJS.Timeout>()
  private readonly debounceMs: number

  constructor(
    private readonly adapter: AgentAdapter,
    options: SessionWatcherOptions = {}
  ) {
    super()
    this.debounceMs = options.debounceMs ?? 100
  }

  /** Resolves once the initial scan is complete (existing files produce deltas too). */
  async start(): Promise<void> {
    if (this.watcher) throw new Error('SessionWatcher already started')
    const watcher = watch(this.adapter.watchRoots(), { ignoreInitial: false })
    this.watcher = watcher
    watcher.on('add', (filePath) => this.schedule(filePath))
    watcher.on('change', (filePath) => this.schedule(filePath))
    watcher.on('error', (error) => this.emit('error', error))
    await new Promise<void>((resolve) => watcher.once('ready', resolve))
  }

  async close(): Promise<void> {
    for (const timer of this.pending.values()) clearTimeout(timer)
    this.pending.clear()
    await this.watcher?.close()
    this.watcher = null
  }

  private schedule(filePath: string): void {
    if (!this.adapter.sessionRefForPath(filePath)) return
    const existing = this.pending.get(filePath)
    if (existing) clearTimeout(existing)
    this.pending.set(
      filePath,
      setTimeout(() => {
        this.pending.delete(filePath)
        void this.drain(filePath)
      }, this.debounceMs)
    )
  }

  private async drain(filePath: string): Promise<void> {
    const ref = this.adapter.sessionRefForPath(filePath)
    if (!ref) return
    let tailer = this.tailers.get(filePath)
    if (!tailer) {
      tailer = new JsonlTailer(filePath)
      this.tailers.set(filePath, tailer)
    }
    try {
      const lines = await tailer.readNewLines()
      if (lines.length === 0) return
      const events = lines.flatMap((line) => this.adapter.parseLine(line))
      if (events.length === 0) return
      const delta: SessionDelta = {
        agent: this.adapter.kind,
        sessionId: ref.sessionId,
        projectKey: ref.projectKey,
        transcriptPath: filePath,
        events
      }
      this.emit('delta', delta)
    } catch (error) {
      this.emit('error', error)
    }
  }
}
