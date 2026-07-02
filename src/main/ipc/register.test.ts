import { describe, expect, it, vi } from 'vitest'
import type { SessionState } from '../../shared/domain'
import { IpcChannels } from '../../shared/ipc'

const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
const sentMessages: Array<{ channel: string; payload: unknown }> = []

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): void => {
      handlers.set(channel, handler)
    },
    removeHandler: (channel: string): void => {
      handlers.delete(channel)
    }
  },
  BrowserWindow: {
    getAllWindows: (): Array<{ webContents: { send: (c: string, p: unknown) => void } }> => [
      { webContents: { send: (channel, payload) => sentMessages.push({ channel, payload }) } }
    ]
  }
}))

const { registerSessionIpc } = await import('./register')

const fakeState = { sessionId: 'aaa', agent: 'claude-code' } as SessionState

function createFakeService(): {
  service: Parameters<typeof registerSessionIpc>[0]
  pushUpdate: (sessions: SessionState[]) => void
} {
  let updateListener: ((sessions: SessionState[]) => void) | null = null
  const service = {
    getSnapshot: () => [fakeState],
    getEvents: (key: string) =>
      key === 'claude-code:-p:aaa' ? [{ kind: 'user-message', timestamp: 1, text: 'hi' }] : [],
    onUpdate: (listener: (sessions: SessionState[]) => void) => {
      updateListener = listener
      return () => {
        updateListener = null
      }
    }
  } as unknown as Parameters<typeof registerSessionIpc>[0]
  return { service, pushUpdate: (sessions) => updateListener?.(sessions) }
}

describe('registerSessionIpc contract', () => {
  it('serves snapshots, events, and broadcasts updates on the declared channels', () => {
    const { service, pushUpdate } = createFakeService()
    const dispose = registerSessionIpc(service)

    const snapshot = handlers.get(IpcChannels.sessionsSnapshot)?.({}) as {
      sessions: SessionState[]
      generatedAt: number
    }
    expect(snapshot.sessions).toEqual([fakeState])
    expect(snapshot.generatedAt).toBeGreaterThan(0)

    const events = handlers.get(IpcChannels.sessionsEvents)?.({}, 'claude-code:-p:aaa')
    expect(events).toEqual({ events: [{ kind: 'user-message', timestamp: 1, text: 'hi' }] })

    // Non-string session keys must not reach the service.
    expect(handlers.get(IpcChannels.sessionsEvents)?.({}, { evil: true })).toEqual({ events: [] })

    pushUpdate([fakeState])
    expect(sentMessages).toEqual([
      { channel: IpcChannels.sessionsUpdated, payload: { sessions: [fakeState] } }
    ])

    dispose()
    expect(handlers.size).toBe(0)
  })
})
