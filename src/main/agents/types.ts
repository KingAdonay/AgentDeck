/**
 * The normalized domain model every agent adapter maps into.
 * This module (and everything under agents/) must stay pure TypeScript —
 * no Electron imports — so it is testable against fixtures with Vitest.
 * See docs/adr/0001-domain-model.md for the reasoning.
 */

export type AgentKind = 'claude-code' | 'codex-cli'

export type SessionStatus = 'working' | 'awaiting-input' | 'idle' | 'done'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

/** A session as discovered on disk, before any transcript parsing. */
export interface AgentSession {
  agent: AgentKind
  sessionId: string
  transcriptPath: string
  /** The agent's own encoding of the project directory; unique per project. */
  projectKey: string
  /**
   * Best-effort decode of projectKey to an absolute path. Slug encodings are
   * lossy (dashes in directory names are ambiguous) — the authoritative path
   * is the cwd carried on transcript events.
   */
  projectPathGuess: string
  lastModifiedAt: number
  sizeBytes: number
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

/**
 * The contract each supported agent implements. Adding an agent to AgentDeck
 * means implementing this interface plus fixtures — nothing else.
 */
export interface AgentAdapter {
  readonly kind: AgentKind
  /** Directories to watch for transcript changes. */
  watchRoots(): string[]
  /** Enumerate every session this agent has recorded on disk. */
  discoverSessions(): Promise<AgentSession[]>
  /** Identify a transcript file; null if the path is not one of ours. */
  sessionRefForPath(filePath: string): Pick<AgentSession, 'sessionId' | 'projectKey'> | null
  /**
   * Parse one raw transcript line into zero or more normalized events.
   * Must never throw: unknown entry types and malformed lines yield [].
   */
  parseLine(line: string): AgentEvent[]
}
