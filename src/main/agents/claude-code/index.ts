import type { AgentAdapter, AgentEvent, AgentSession } from '../types'
import { defaultProjectsRoot, discoverClaudeSessions, sessionRefForPath } from './discovery'
import { parseClaudeLine } from './parse'

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly kind = 'claude-code' as const
  private readonly projectsRoot: string

  constructor(projectsRoot: string = defaultProjectsRoot()) {
    this.projectsRoot = projectsRoot
  }

  watchRoots(): string[] {
    return [this.projectsRoot]
  }

  discoverSessions(): Promise<AgentSession[]> {
    return discoverClaudeSessions(this.projectsRoot)
  }

  sessionRefForPath(filePath: string): Pick<AgentSession, 'sessionId' | 'projectKey'> | null {
    return sessionRefForPath(this.projectsRoot, filePath)
  }

  parseLine(line: string): AgentEvent[] {
    return parseClaudeLine(line)
  }
}
