import type { AgentEventKind, SessionStatus } from '../agents/types'

export interface StatusThresholds {
  /** Agent was mid-turn but nothing new for this long → it stalled out. */
  workingStaleMs: number
  /** No activity at all for this long → the session is over. */
  doneAfterMs: number
}

export const DEFAULT_THRESHOLDS: StatusThresholds = {
  workingStaleMs: 2 * 60_000,
  doneAfterMs: 60 * 60_000
}

/**
 * Status is a pure function of (what happened last, how long ago):
 *
 * - last event from the agent's turn machinery (user prompt, tool call,
 *   tool result) and recent → the agent is `working`; gone quiet → `idle`.
 * - last event is assistant text → the agent ended its turn and is
 *   `awaiting-input` from the human.
 * - anything older than doneAfterMs → `done`.
 *
 * Timestamps come from the transcript itself, never file mtimes, so replaying
 * a transcript at any `now` gives deterministic, testable results.
 */
export function deriveStatus(
  lastEventKind: AgentEventKind | null,
  lastActivityAt: number | null,
  now: number,
  thresholds: StatusThresholds = DEFAULT_THRESHOLDS
): SessionStatus {
  if (lastActivityAt === null) return 'idle'
  const age = now - lastActivityAt
  if (age > thresholds.doneAfterMs) return 'done'

  switch (lastEventKind) {
    case 'user-message':
    case 'tool-call':
    case 'tool-result':
      return age <= thresholds.workingStaleMs ? 'working' : 'idle'
    case 'assistant-message':
      return 'awaiting-input'
    default:
      return 'idle'
  }
}
