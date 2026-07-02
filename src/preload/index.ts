import { contextBridge } from 'electron'

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
  }
} as const

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
