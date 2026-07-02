import { Notification } from 'electron'
import type { SessionState, SessionStatus } from '../../shared/domain'
import type { NotificationPrefs } from '../settings/store'
import { computeTransitions, notificationsFor } from './engine'

export interface NotifierDeps {
  getStates: () => SessionState[]
  getPrefs: () => NotificationPrefs
  reveal: (sessionKey: string) => void
  now?: () => number
}

/**
 * Thin Electron shell around the pure engine: ticks on session updates (for
 * immediate transitions like → awaiting-input) and on an interval (for pure
 * time-decay transitions like working → idle), showing native notifications
 * whose click deep-links to the session.
 *
 * AGENTDECK_DISABLE_NOTIFICATIONS=1 silences it (e2e, CI).
 */
export class SessionNotifier {
  private statuses = new Map<string, SessionStatus>()
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly deps: NotifierDeps) {}

  start(intervalMs = 15_000): void {
    this.tick()
    this.timer = setInterval(() => this.tick(), intervalMs)
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  tick(): void {
    const now = this.deps.now?.() ?? Date.now()
    const { transitions, statuses } = computeTransitions(this.statuses, this.deps.getStates(), now)
    this.statuses = statuses

    if (process.env['AGENTDECK_DISABLE_NOTIFICATIONS'] === '1') return
    if (!Notification.isSupported()) return

    for (const spec of notificationsFor(transitions, this.deps.getPrefs())) {
      const notification = new Notification({ title: spec.title, body: spec.body })
      notification.on('click', () => this.deps.reveal(spec.sessionKey))
      notification.show()
    }
  }
}
