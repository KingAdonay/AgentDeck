import { sessionKey, type SessionState, type SessionStatus } from '../../shared/domain'
import { deriveStatus } from '../../shared/status'
import type { NotificationPrefs } from '../settings/store'

export interface StatusTransition {
  key: string
  state: SessionState
  from: SessionStatus
  to: SessionStatus
}

export interface TransitionResult {
  transitions: StatusTransition[]
  statuses: Map<string, SessionStatus>
}

/**
 * Diff current statuses against the previous tick. A session seen for the
 * first time (startup replay, newly discovered transcript) produces no
 * transition — only genuine status *changes* can notify.
 */
export function computeTransitions(
  previous: ReadonlyMap<string, SessionStatus>,
  states: readonly SessionState[],
  now: number
): TransitionResult {
  const statuses = new Map<string, SessionStatus>()
  const transitions: StatusTransition[] = []

  for (const state of states) {
    const key = sessionKey(state.agent, state.projectKey, state.sessionId)
    const to = deriveStatus(state.lastEventKind, state.lastActivityAt, now)
    statuses.set(key, to)
    const from = previous.get(key)
    if (from !== undefined && from !== to) {
      transitions.push({ key, state, from, to })
    }
  }
  return { transitions, statuses }
}

export interface NotificationSpec {
  sessionKey: string
  title: string
  body: string
}

function sessionName(state: SessionState): string {
  return state.title ?? state.lastPrompt ?? `Session ${state.sessionId.slice(0, 8)}`
}

function projectName(state: SessionState): string {
  return state.projectPath.split('/').filter(Boolean).slice(-2).join('/') || state.projectPath
}

/** Map status transitions to notifications according to preferences. */
export function notificationsFor(
  transitions: readonly StatusTransition[],
  prefs: NotificationPrefs
): NotificationSpec[] {
  const specs: NotificationSpec[] = []
  for (const { key, state, from, to } of transitions) {
    if (to === 'awaiting-input' && prefs.awaitingInput) {
      specs.push({
        sessionKey: key,
        title: sessionName(state),
        body: `Needs your input · ${projectName(state)}`
      })
    } else if (to === 'idle' && from === 'working' && prefs.stalled) {
      specs.push({
        sessionKey: key,
        title: sessionName(state),
        body: `May have stalled mid-turn · ${projectName(state)}`
      })
    } else if (to === 'done' && prefs.done) {
      specs.push({
        sessionKey: key,
        title: sessionName(state),
        body: `Session finished · ${projectName(state)}`
      })
    }
  }
  return specs
}
