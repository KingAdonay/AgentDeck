/**
 * Main-process-only agent contracts. The pure domain model lives in
 * src/shared/domain.ts (shared with preload and renderer); this module adds
 * the on-disk discovery types and the adapter interface.
 * See docs/adr/0001-domain-model.md.
 */
import type { AgentEvent, AgentKind } from '../../shared/domain'

export type {
  AgentEvent,
  AgentEventKind,
  AgentKind,
  AssistantMessageEvent,
  SessionMetaEvent,
  SessionStatus,
  TokenUsage,
  ToolCallEvent,
  ToolResultEvent,
  UserMessageEvent
} from '../../shared/domain'

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
