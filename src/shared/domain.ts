/**
 * The pure domain model, shared by main, preload, and renderer.
 * Everything here must be plain data + pure functions — no Node, no Electron.
 */

export type AgentKind = 'claude-code' | 'codex-cli'

export type SessionStatus = 'working' | 'awaiting-input' | 'idle' | 'done'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

interface AgentEventBase {
  /** ms since epoch; null for metadata entries that carry no timestamp. */
  timestamp: number | null
}

/** A real prompt typed by the human (IDE/system-injected context is filtered out). */
export interface UserMessageEvent extends AgentEventBase {
  kind: 'user-message'
  text: string
  cwd?: string
  gitBranch?: string
}

export interface AssistantMessageEvent extends AgentEventBase {
  kind: 'assistant-message'
  text: string
  model?: string
  /** Provider message id; used to deduplicate usage across entries. */
  messageId?: string
  usage?: TokenUsage
}

export interface ToolCallEvent extends AgentEventBase {
  kind: 'tool-call'
  toolName: string
  description?: string
  model?: string
  messageId?: string
  usage?: TokenUsage
}

export interface ToolResultEvent extends AgentEventBase {
  kind: 'tool-result'
  isError: boolean
}

/** Session-level metadata (title, last prompt) without a timestamp. */
export interface SessionMetaEvent extends AgentEventBase {
  kind: 'session-meta'
  title?: string
  lastPrompt?: string
}

export type AgentEvent =
  UserMessageEvent | AssistantMessageEvent | ToolCallEvent | ToolResultEvent | SessionMetaEvent

export type AgentEventKind = AgentEvent['kind']

/** Everything the UI needs to render one session, derived from events. */
export interface SessionState {
  agent: AgentKind
  sessionId: string
  transcriptPath: string
  projectKey: string
  /** From event cwd when available, else the discovery-time guess. */
  projectPath: string
  title: string | null
  lastPrompt: string | null
  lastAssistantText: string | null
  model: string | null
  gitBranch: string | null
  lastEventKind: AgentEventKind | null
  firstActivityAt: number | null
  lastActivityAt: number | null
  userMessageCount: number
  toolCallCount: number
  usage: TokenUsage
  /** Adjacent-dedupe cursor for usage (ADR 0001 §6). */
  lastUsageMessageId: string | null
}

/** Stable identity of a session across processes and restarts. */
export function sessionKey(agent: AgentKind, projectKey: string, sessionId: string): string {
  return `${agent}:${projectKey}:${sessionId}`
}
