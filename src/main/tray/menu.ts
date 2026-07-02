import type { MenuItemConstructorOptions } from 'electron'
import { sessionKey, type SessionState, type SessionStatus } from '../../shared/domain'
import { deriveStatus } from '../../shared/status'

export interface TrayHandlers {
  reveal: (sessionKey: string) => void
  openApp: () => void
  quit: () => void
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  working: 'working',
  'awaiting-input': 'needs input',
  idle: 'idle',
  done: 'done'
}

const MAX_MENU_SESSIONS = 5

interface StatusCounts {
  working: number
  awaitingInput: number
}

function countStatuses(states: readonly SessionState[], now: number): StatusCounts {
  const counts: StatusCounts = { working: 0, awaitingInput: 0 }
  for (const state of states) {
    const status = deriveStatus(state.lastEventKind, state.lastActivityAt, now)
    if (status === 'working') counts.working += 1
    if (status === 'awaiting-input') counts.awaitingInput += 1
  }
  return counts
}

function sessionLabel(state: SessionState, now: number): string {
  const name = state.title ?? state.lastPrompt ?? `Session ${state.sessionId.slice(0, 8)}`
  const truncated = name.length > 40 ? `${name.slice(0, 40)}…` : name
  return `${truncated} — ${STATUS_LABEL[deriveStatus(state.lastEventKind, state.lastActivityAt, now)]}`
}

export function trayTooltip(states: readonly SessionState[], now: number): string {
  const { working, awaitingInput } = countStatuses(states, now)
  return `AgentDeck — ${working} working · ${awaitingInput} need input`
}

/**
 * Pure menu template so the tray's contents are unit-testable; the Electron
 * Tray/Menu wrapper around it stays trivial.
 */
export function buildTrayMenuTemplate(
  states: readonly SessionState[],
  now: number,
  handlers: TrayHandlers
): MenuItemConstructorOptions[] {
  const { working, awaitingInput } = countStatuses(states, now)
  const recent = [...states]
    .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
    .slice(0, MAX_MENU_SESSIONS)

  const sessionItems: MenuItemConstructorOptions[] =
    recent.length === 0
      ? [{ label: 'No sessions yet', enabled: false }]
      : recent.map((state) => ({
          label: sessionLabel(state, now),
          click: () => handlers.reveal(sessionKey(state.agent, state.projectKey, state.sessionId))
        }))

  return [
    { label: `${working} working · ${awaitingInput} need input`, enabled: false },
    { type: 'separator' },
    ...sessionItems,
    { type: 'separator' },
    { label: 'Open AgentDeck', click: () => handlers.openApp() },
    { label: 'Quit AgentDeck', click: () => handlers.quit() }
  ]
}
