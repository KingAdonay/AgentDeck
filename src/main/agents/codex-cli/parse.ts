import type { AgentEvent } from '../types'
import { isInjectedContent } from '../text'

type Json = Record<string, unknown>

function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Parse one Codex CLI rollout line: {timestamp, type, payload}.
 *
 * Only session_meta, turn_context, and response_item are consumed; event_msg
 * lines duplicate response_items (and carry cumulative token counts that
 * don't fit the per-message usage model), so they are deliberately ignored —
 * Codex sessions currently report zero token usage. Never throws (ADR 0001 §3).
 */
export function parseCodexLine(line: string): AgentEvent[] {
  const trimmed = line.trim()
  if (trimmed === '') return []

  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return []
  }
  const entry = asObject(raw)
  if (!entry) return []
  const timestamp = parseTimestamp(entry['timestamp'])
  const payload = asObject(entry['payload'])
  if (!payload) return []

  switch (entry['type']) {
    case 'session_meta':
    case 'turn_context':
      return parseContext(payload)
    case 'response_item':
      return parseResponseItem(payload, timestamp)
    default:
      return []
  }
}

/** session_meta and turn_context both carry workspace context. */
function parseContext(payload: Json): AgentEvent[] {
  const cwd = asString(payload['cwd'])
  const git = asObject(payload['git'])
  const gitBranch = (git ? asString(git['branch']) : undefined) ?? asString(payload['git_branch'])
  if (cwd === undefined && gitBranch === undefined) return []
  return [{ kind: 'session-meta', timestamp: null, cwd, gitBranch }]
}

function parseResponseItem(payload: Json, timestamp: number | null): AgentEvent[] {
  switch (payload['type']) {
    case 'message':
      return parseMessage(payload, timestamp)
    case 'function_call': {
      const toolName = asString(payload['name']) ?? 'tool'
      return [
        {
          kind: 'tool-call',
          timestamp,
          toolName,
          description: describeArguments(payload['arguments'])
        }
      ]
    }
    case 'local_shell_call': {
      const action = asObject(payload['action'])
      const command = action?.['command']
      const description = Array.isArray(command)
        ? command.filter((part): part is string => typeof part === 'string').join(' ')
        : undefined
      return [{ kind: 'tool-call', timestamp, toolName: 'shell', description }]
    }
    case 'custom_tool_call': {
      const toolName = asString(payload['name']) ?? 'tool'
      return [{ kind: 'tool-call', timestamp, toolName, description: asString(payload['input']) }]
    }
    case 'function_call_output':
    case 'custom_tool_call_output':
      return [{ kind: 'tool-result', timestamp, isError: outputIsError(payload['output']) }]
    default:
      // reasoning, web_search_call, and future types are not timeline events.
      return []
  }
}

function parseMessage(payload: Json, timestamp: number | null): AgentEvent[] {
  const role = asString(payload['role'])
  const content = payload['content']
  if (!Array.isArray(content)) return []

  const events: AgentEvent[] = []
  for (const rawBlock of content) {
    const block = asObject(rawBlock)
    if (!block) continue
    const text = asString(block['text'])
    if (text === undefined || text.trim() === '') continue

    if (role === 'user' && (block['type'] === 'input_text' || block['type'] === 'text')) {
      // developer/system instructions and tag-wrapped context are not the human.
      if (!isInjectedContent(text)) events.push({ kind: 'user-message', timestamp, text })
    } else if (
      role === 'assistant' &&
      (block['type'] === 'output_text' || block['type'] === 'text')
    ) {
      events.push({ kind: 'assistant-message', timestamp, text })
    }
  }
  return events
}

/** arguments is a JSON string like {"command":["bash","-lc","ls"]}. */
function describeArguments(value: unknown): string | undefined {
  const raw = asString(value)
  if (raw === undefined) return undefined
  try {
    const parsed = asObject(JSON.parse(raw))
    const command = parsed?.['command']
    if (typeof command === 'string') return command
    if (Array.isArray(command)) {
      return command.filter((part): part is string => typeof part === 'string').join(' ')
    }
  } catch {
    // opaque arguments — no description
  }
  return undefined
}

/** Shell outputs encode {"output":"...","metadata":{"exit_code":N,...}} as a JSON string. */
function outputIsError(value: unknown): boolean {
  const raw = asString(value)
  if (raw === undefined) return false
  try {
    const parsed = asObject(JSON.parse(raw))
    const metadata = parsed ? asObject(parsed['metadata']) : null
    const exitCode = metadata?.['exit_code']
    return typeof exitCode === 'number' && exitCode !== 0
  } catch {
    return false
  }
}
