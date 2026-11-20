import { BrowserWindow, ipcMain } from 'electron'
import {
  IpcChannels,
  type SessionsUpdatedPayload,
  type SnapshotResponse,
  type WorkspaceStatsPayload
} from '../../shared/ipc'
import type { AgentKind } from '../../shared/domain'
import type { HistoryListResponse, HistoryQuery } from '../../shared/history'
import type { WorkspaceStatsService } from '../git/diff-stats'
import { MAX_PAGE_SIZE, type HistoryStore } from '../history/store'
import type { SessionService } from '../sessions/service'

/**
 * Wires the SessionService to the renderer: two invoke handlers plus a
 * broadcast of updated session states to every open window.
 * Returns an unsubscribe function (used by tests; the app runs it for life).
 */
export function registerSessionIpc(service: SessionService): () => void {
  ipcMain.handle(IpcChannels.sessionsSnapshot, (): SnapshotResponse => {
    return { sessions: service.getSnapshot(), generatedAt: Date.now() }
  })

  ipcMain.handle(IpcChannels.sessionsEvents, (_event, key: unknown) => {
    return { events: typeof key === 'string' ? service.getEvents(key) : [] }
  })

  const unsubscribe = service.onUpdate((sessions) => {
    const payload: SessionsUpdatedPayload = { sessions }
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannels.sessionsUpdated, payload)
    }
  })

  return () => {
    unsubscribe()
    ipcMain.removeHandler(IpcChannels.sessionsSnapshot)
    ipcMain.removeHandler(IpcChannels.sessionsEvents)
  }
}

export function registerWorkspaceIpc(service: WorkspaceStatsService): void {
  ipcMain.handle(IpcChannels.workspaceSnapshot, (): WorkspaceStatsPayload => {
    return { stats: service.getSnapshot() }
  })
}

export function broadcastWorkspaceStats(payload: WorkspaceStatsPayload): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IpcChannels.workspaceUpdated, payload)
  }
}

const AGENT_KINDS: readonly AgentKind[] = ['claude-code', 'codex-cli']

/**
 * The query arrives from the renderer, so treat it as untrusted: keep only
 * well-typed fields and clamp sizes.
 */
export function sanitizeHistoryQuery(raw: unknown): HistoryQuery {
  const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const query: HistoryQuery = {}
  const search = input['search']
  if (typeof search === 'string' && search.trim() !== '') query.search = search.slice(0, 200)
  const agent = input['agent']
  if (AGENT_KINDS.includes(agent as AgentKind)) query.agent = agent as AgentKind
  const since = input['since']
  if (typeof since === 'number' && Number.isFinite(since)) query.since = since
  const limit = input['limit']
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    query.limit = Math.min(Math.max(Math.floor(limit), 1), MAX_PAGE_SIZE)
  }
  const offset = input['offset']
  if (typeof offset === 'number' && Number.isFinite(offset)) {
    query.offset = Math.max(Math.floor(offset), 0)
  }
  return query
}

export function registerHistoryIpc(store: HistoryStore): void {
  ipcMain.handle(IpcChannels.historyList, (_event, raw: unknown): HistoryListResponse => {
    return store.list(sanitizeHistoryQuery(raw))
  })
}
