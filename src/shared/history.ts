import type { AgentKind } from './domain'

/**
 * One finished-or-ongoing task as kept in the local history database.
 * Metadata only: the transcript itself is never stored, just a short
 * highlight of the first prompt.
 */
export interface TaskRecord {
  key: string
  agent: AgentKind
  sessionId: string
  projectKey: string
  projectPath: string
  gitBranch: string | null
  /** Agent-generated title (Claude Code); null when the agent has none. */
  title: string | null
  /** First prompt, whitespace-collapsed and cut to HIGHLIGHT_MAX_CHARS. */
  highlight: string | null
  model: string | null
  startedAt: number | null
  lastActivityAt: number
  userMessageCount: number
  toolCallCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  linesAdded: number
  linesRemoved: number
  filesChanged: number
}

export const HIGHLIGHT_MAX_CHARS = 200

export interface HistoryQuery {
  /** Case-insensitive match on title, highlight, project path, and branch. */
  search?: string
  agent?: AgentKind
  /** Inclusive lower bound on lastActivityAt (ms since epoch). */
  since?: number
  limit?: number
  offset?: number
}

export interface HistoryListResponse {
  tasks: TaskRecord[]
  /** Total matches ignoring limit/offset, for "load more". */
  total: number
}
