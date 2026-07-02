import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannels,
  type EventsResponse,
  type RevealPayload,
  type SessionsUpdatedPayload,
  type SnapshotResponse
} from '../shared/ipc'

/**
 * The only surface the renderer can touch. Every privileged capability is
 * added here explicitly — never expose ipcRenderer (or any Electron/Node
 * primitive) wholesale.
 */
const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node ?? ''
  },
  sessions: {
    getSnapshot: (): Promise<SnapshotResponse> =>
      ipcRenderer.invoke(IpcChannels.sessionsSnapshot) as Promise<SnapshotResponse>,
    getEvents: (sessionKey: string): Promise<EventsResponse> =>
      ipcRenderer.invoke(IpcChannels.sessionsEvents, sessionKey) as Promise<EventsResponse>,
    /** Subscribe to live updates; returns an unsubscribe function. */
    onUpdated: (callback: (payload: SessionsUpdatedPayload) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, payload: SessionsUpdatedPayload): void =>
        callback(payload)
      ipcRenderer.on(IpcChannels.sessionsUpdated, listener)
      return () => {
        ipcRenderer.removeListener(IpcChannels.sessionsUpdated, listener)
      }
    },
    /** Deep-link from a notification or tray click; returns an unsubscribe function. */
    onReveal: (callback: (payload: RevealPayload) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, payload: RevealPayload): void => callback(payload)
      ipcRenderer.on(IpcChannels.sessionsReveal, listener)
      return () => {
        ipcRenderer.removeListener(IpcChannels.sessionsReveal, listener)
      }
    }
  }
} as const

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
