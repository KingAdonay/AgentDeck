import { create } from 'zustand'
import { sessionKey, type SessionState } from '../../shared/domain'
import type { GitDiffStats } from '../../shared/workspace'

interface SessionsStore {
  sessions: Record<string, SessionState>
  workspaceStats: Record<string, GitDiffStats>
  phase: 'loading' | 'ready' | 'error'
  errorMessage: string | null
  hydrate: () => Promise<void>
  upsert: (updated: SessionState[]) => void
  setWorkspaceStats: (stats: Record<string, GitDiffStats>) => void
}

const keyOf = (s: SessionState): string => sessionKey(s.agent, s.projectKey, s.sessionId)

/**
 * Renderer-side mirror of the main process SessionService: hydrated from a
 * snapshot, kept fresh by upserts from the sessions:updated broadcast.
 */
export const useSessionsStore = create<SessionsStore>((set) => ({
  sessions: {},
  workspaceStats: {},
  phase: 'loading',
  errorMessage: null,

  hydrate: async () => {
    try {
      const [snapshot, workspace] = await Promise.all([
        window.api.sessions.getSnapshot(),
        window.api.workspace.getSnapshot()
      ])
      const sessions: Record<string, SessionState> = {}
      for (const session of snapshot.sessions) sessions[keyOf(session)] = session
      set({ sessions, workspaceStats: workspace.stats, phase: 'ready', errorMessage: null })
    } catch (error) {
      set({ phase: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  },

  setWorkspaceStats: (stats) => set({ workspaceStats: stats }),

  upsert: (updated) =>
    set((state) => {
      const sessions = { ...state.sessions }
      for (const session of updated) sessions[keyOf(session)] = session
      return { sessions }
    })
}))
