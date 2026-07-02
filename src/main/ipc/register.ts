import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannels, type SessionsUpdatedPayload, type SnapshotResponse } from '../../shared/ipc'
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
