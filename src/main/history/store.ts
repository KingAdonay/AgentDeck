import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { HistoryListResponse, HistoryQuery, TaskRecord } from '../../shared/history'

/** Each entry migrates the schema from user_version = index to index + 1. */
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE tasks (
     key                   TEXT PRIMARY KEY,
     agent                 TEXT NOT NULL,
     session_id            TEXT NOT NULL,
     project_key           TEXT NOT NULL,
     project_path          TEXT NOT NULL,
     git_branch            TEXT,
     title                 TEXT,
     highlight             TEXT,
     model                 TEXT,
     started_at            INTEGER,
     last_activity_at      INTEGER NOT NULL,
     user_message_count    INTEGER NOT NULL DEFAULT 0,
     tool_call_count       INTEGER NOT NULL DEFAULT 0,
     input_tokens          INTEGER NOT NULL DEFAULT 0,
     output_tokens         INTEGER NOT NULL DEFAULT 0,
     cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
     cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
     lines_added           INTEGER NOT NULL DEFAULT 0,
     lines_removed         INTEGER NOT NULL DEFAULT 0,
     files_changed         INTEGER NOT NULL DEFAULT 0,
     recorded_at           INTEGER NOT NULL
   );
   CREATE INDEX tasks_last_activity ON tasks (last_activity_at DESC);
   CREATE INDEX tasks_agent ON tasks (agent);`
]

const COLUMNS = [
  ['key', 'key'],
  ['agent', 'agent'],
  ['session_id', 'sessionId'],
  ['project_key', 'projectKey'],
  ['project_path', 'projectPath'],
  ['git_branch', 'gitBranch'],
  ['title', 'title'],
  ['highlight', 'highlight'],
  ['model', 'model'],
  ['started_at', 'startedAt'],
  ['last_activity_at', 'lastActivityAt'],
  ['user_message_count', 'userMessageCount'],
  ['tool_call_count', 'toolCallCount'],
  ['input_tokens', 'inputTokens'],
  ['output_tokens', 'outputTokens'],
  ['cache_read_tokens', 'cacheReadTokens'],
  ['cache_creation_tokens', 'cacheCreationTokens'],
  ['lines_added', 'linesAdded'],
  ['lines_removed', 'linesRemoved'],
  ['files_changed', 'filesChanged']
] as const satisfies ReadonlyArray<readonly [string, keyof TaskRecord]>

const UPSERT_SQL = `
  INSERT INTO tasks (${COLUMNS.map(([column]) => column).join(', ')}, recorded_at)
  VALUES (${COLUMNS.map(([, field]) => `:${field}`).join(', ')}, :recordedAt)
  ON CONFLICT (key) DO UPDATE SET
    ${COLUMNS.filter(([column]) => column !== 'key')
      .map(([column]) => `${column} = excluded.${column}`)
      .join(',\n    ')},
    recorded_at = excluded.recorded_at
  -- A partially re-read transcript must never overwrite a fuller record.
  WHERE excluded.last_activity_at >= tasks.last_activity_at`

export const MAX_PAGE_SIZE = 200

/**
 * Durable, metadata-only record of every task AgentDeck has seen. Outlives
 * the agents' own transcripts, which they delete on logout or after a while.
 */
export class HistoryStore {
  private readonly db: DatabaseSync

  constructor(filePath: string) {
    if (filePath !== ':memory:') mkdirSync(dirname(filePath), { recursive: true })
    this.db = new DatabaseSync(filePath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.migrate()
  }

  get schemaVersion(): number {
    const row = this.db.prepare('PRAGMA user_version').get() as { user_version: number }
    return row.user_version
  }

  upsertMany(records: readonly TaskRecord[], now: number = Date.now()): void {
    if (records.length === 0) return
    const statement = this.db.prepare(UPSERT_SQL)
    this.transaction(() => {
      for (const record of records) {
        const params: Record<string, SQLInputValue> = { recordedAt: now }
        for (const [, field] of COLUMNS) params[field] = record[field]
        statement.run(params)
      }
    })
  }

  list(query: HistoryQuery = {}): HistoryListResponse {
    const conditions: string[] = []
    const params: Record<string, SQLInputValue> = {}
    if (query.agent !== undefined) {
      conditions.push('agent = :agent')
      params['agent'] = query.agent
    }
    if (query.since !== undefined) {
      conditions.push('last_activity_at >= :since')
      params['since'] = query.since
    }
    const search = query.search?.trim()
    if (search !== undefined && search !== '') {
      conditions.push(
        `(title LIKE :search ESCAPE '\\' OR highlight LIKE :search ESCAPE '\\'
          OR project_path LIKE :search ESCAPE '\\' OR git_branch LIKE :search ESCAPE '\\')`
      )
      params['search'] = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total FROM tasks ${where}`)
      .get(params) as { total: number }
    const rows = this.db
      .prepare(
        `SELECT ${COLUMNS.map(([column, field]) => `${column} AS ${field}`).join(', ')}
         FROM tasks ${where}
         ORDER BY last_activity_at DESC
         LIMIT :limit OFFSET :offset`
      )
      .all({
        ...params,
        limit: Math.min(Math.max(query.limit ?? 50, 1), MAX_PAGE_SIZE),
        offset: Math.max(query.offset ?? 0, 0)
      }) as unknown as TaskRecord[]
    // Rows come back with a null prototype; copy into plain objects for IPC.
    return { tasks: rows.map((row) => ({ ...row })), total }
  }

  close(): void {
    if (this.db.isOpen) this.db.close()
  }

  private migrate(): void {
    for (let version = this.schemaVersion; version < MIGRATIONS.length; version++) {
      this.transaction(() => {
        this.db.exec(MIGRATIONS[version] ?? '')
        this.db.exec(`PRAGMA user_version = ${version + 1}`)
      })
    }
  }

  private transaction(work: () => void): void {
    this.db.exec('BEGIN')
    try {
      work()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}
