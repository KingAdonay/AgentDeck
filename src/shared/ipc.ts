import type { AgentEvent, SessionState } from './domain'

/**
 * The complete IPC surface between main and renderer. Every channel is
 * listed here with its payload types; preload exposes exactly these and
 * nothing else.
 */
export const IpcChannels = {
  /** invoke: () → SnapshotResponse */
  sessionsSnapshot: 'sessions:snapshot',
  /** invoke: (sessionKey: string) → EventsResponse */
  sessionsEvents: 'sessions:events',
  /** main → renderer push: SessionsUpdatedPayload */
  sessionsUpdated: 'sessions:updated',
  /** main → renderer push: RevealPayload (notification/tray deep-link) */
  sessionsReveal: 'sessions:reveal'
} as const

export interface SnapshotResponse {
  sessions: SessionState[]
  generatedAt: number
}

export interface EventsResponse {
  events: AgentEvent[]
}

export interface SessionsUpdatedPayload {
  sessions: SessionState[]
}

export interface RevealPayload {
  sessionKey: string
}
