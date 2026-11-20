import { sessionKey, type SessionState } from '../../shared/domain'
import { HIGHLIGHT_MAX_CHARS, type TaskRecord } from '../../shared/history'

/** Collapse whitespace and cut to a short, single-line highlight. */
export function toHighlight(text: string | null): string | null {
  if (text === null) return null
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed === '') return null
  return collapsed.length > HIGHLIGHT_MAX_CHARS
    ? collapsed.slice(0, HIGHLIGHT_MAX_CHARS - 1).trimEnd() + '…'
    : collapsed
}

/** Map live session state to its history row; null until the session has any activity. */
export function toTaskRecord(state: SessionState): TaskRecord | null {
  if (state.lastActivityAt === null) return null
  return {
    key: sessionKey(state.agent, state.projectKey, state.sessionId),
    agent: state.agent,
    sessionId: state.sessionId,
    projectKey: state.projectKey,
    projectPath: state.projectPath,
    gitBranch: state.gitBranch,
    title: state.title,
    highlight: toHighlight(state.firstPrompt),
    model: state.model,
    startedAt: state.firstActivityAt,
    lastActivityAt: state.lastActivityAt,
    userMessageCount: state.userMessageCount,
    toolCallCount: state.toolCallCount,
    inputTokens: state.usage.inputTokens,
    outputTokens: state.usage.outputTokens,
    cacheReadTokens: state.usage.cacheReadInputTokens,
    cacheCreationTokens: state.usage.cacheCreationInputTokens,
    linesAdded: state.linesAdded,
    linesRemoved: state.linesRemoved,
    filesChanged: state.filesTouched.length
  }
}
