import type { AgentEvent, FileEdit, SessionState, TokenUsage } from '../../shared/domain'
import type { AgentSession } from '../agents/types'

export type { SessionState } from '../../shared/domain'

export function createSessionState(session: AgentSession): SessionState {
  return {
    agent: session.agent,
    sessionId: session.sessionId,
    transcriptPath: session.transcriptPath,
    projectKey: session.projectKey,
    projectPath: session.projectPathGuess,
    title: null,
    lastPrompt: null,
    firstPrompt: null,
    lastAssistantText: null,
    model: null,
    gitBranch: null,
    lastEventKind: null,
    firstActivityAt: null,
    lastActivityAt: null,
    userMessageCount: 0,
    toolCallCount: 0,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0
    },
    linesAdded: 0,
    linesRemoved: 0,
    filesTouched: [],
    lastUsageMessageId: null
  }
}

export function applyEvent(state: SessionState, event: AgentEvent): SessionState {
  if (event.kind === 'session-meta') {
    return {
      ...state,
      title: event.title ?? state.title,
      lastPrompt: event.lastPrompt ?? state.lastPrompt,
      projectPath: event.cwd ?? state.projectPath,
      gitBranch: event.gitBranch ?? state.gitBranch,
      model: event.model ?? state.model,
      usage: event.cumulativeUsage ?? state.usage
    }
  }

  const next: SessionState = {
    ...state,
    lastEventKind: event.kind,
    firstActivityAt: state.firstActivityAt ?? event.timestamp,
    lastActivityAt: event.timestamp ?? state.lastActivityAt
  }

  switch (event.kind) {
    case 'user-message':
      next.userMessageCount += 1
      // Doubles as the card title for agents without title metadata (Codex).
      next.lastPrompt = event.text
      next.firstPrompt ??= event.text
      next.projectPath = event.cwd ?? next.projectPath
      next.gitBranch = event.gitBranch ?? next.gitBranch
      break
    case 'assistant-message':
      next.lastAssistantText = event.text
      next.model = event.model ?? next.model
      countUsage(next, event.messageId, event.usage)
      break
    case 'tool-call':
      next.toolCallCount += 1
      next.model = event.model ?? next.model
      countUsage(next, event.messageId, event.usage)
      countEdits(next, event.edits)
      break
    case 'tool-result':
      countEdits(next, event.edits)
      break
  }
  return next
}

export function applyEvents(state: SessionState, events: readonly AgentEvent[]): SessionState {
  return events.reduce(applyEvent, state)
}

/**
 * One assistant message spans several transcript entries repeating identical
 * usage; count each provider messageId once. Entries for the same message are
 * written adjacently, so an adjacent-dedupe cursor suffices.
 */
function countUsage(
  state: SessionState,
  messageId: string | undefined,
  usage: TokenUsage | undefined
): void {
  if (!usage) return
  if (messageId !== undefined && messageId === state.lastUsageMessageId) return
  state.usage = {
    inputTokens: state.usage.inputTokens + usage.inputTokens,
    outputTokens: state.usage.outputTokens + usage.outputTokens,
    cacheReadInputTokens: state.usage.cacheReadInputTokens + usage.cacheReadInputTokens,
    cacheCreationInputTokens: state.usage.cacheCreationInputTokens + usage.cacheCreationInputTokens
  }
  state.lastUsageMessageId = messageId ?? null
}

function countEdits(state: SessionState, edits: readonly FileEdit[] | undefined): void {
  if (!edits || edits.length === 0) return
  let touched: string[] | null = null
  for (const edit of edits) {
    state.linesAdded += edit.added
    state.linesRemoved += edit.removed
    if (!state.filesTouched.includes(edit.path) && !touched?.includes(edit.path)) {
      touched ??= []
      touched.push(edit.path)
    }
  }
  if (touched) state.filesTouched = [...state.filesTouched, ...touched]
}
