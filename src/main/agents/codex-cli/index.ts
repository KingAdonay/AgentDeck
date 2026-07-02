import type { AgentAdapter, AgentEvent, AgentSession } from '../types'
import { defaultSessionsRoot, discoverCodexSessions, sessionRefForPath } from './discovery'
import { parseCodexLine } from './parse'

export class CodexCliAdapter implements AgentAdapter {
  readonly kind = 'codex-cli' as const
  private readonly sessionsRoot: string

  constructor(sessionsRoot: string = defaultSessionsRoot()) {
    this.sessionsRoot = sessionsRoot
  }

  watchRoots(): string[] {
    return [this.sessionsRoot]
  }

  discoverSessions(): Promise<AgentSession[]> {
    return discoverCodexSessions(this.sessionsRoot)
  }

  sessionRefForPath(filePath: string): Pick<AgentSession, 'sessionId' | 'projectKey'> | null {
    return sessionRefForPath(this.sessionsRoot, filePath)
  }

  parseLine(line: string): AgentEvent[] {
    return parseCodexLine(line)
  }
}
