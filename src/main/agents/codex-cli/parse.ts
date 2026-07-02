import type { TokenUsage } from '../../../shared/domain'
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

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Parse one Codex CLI rollout line: {timestamp, type, payload}.
 *
 * session_meta, turn_context, and response_item are consumed, plus the
 * token_count subtype of event_msg (as a cumulative usage snapshot). Other
 * event_msg subtypes duplicate response_items and stay ignored — consuming
 * them would double-count the timeline. Never throws (ADR 0001 §3).
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
    case 'event_msg':
      return payload['type'] === 'token_count' ? parseTokenCount(payload) : []
    default:
      return []
  }
}

/** session_meta and turn_context both carry workspace context; turn_context also names the model. */
function parseContext(payload: Json): AgentEvent[] {
  const cwd = asString(payload['cwd'])
  const git = asObject(payload['git'])
  const gitBranch = (git ? asString(git['branch']) : undefined) ?? asString(payload['git_branch'])
  const model = asString(payload['model'])
  if (cwd === undefined && gitBranch === undefined && model === undefined) return []
  return [{ kind: 'session-meta', timestamp: null, cwd, gitBranch, model }]
}

/**
 * token_count events carry cumulative totals for the whole session, so they
 * map to a session-meta usage snapshot (replace semantics) rather than
 * per-message usage. Codex's input_tokens includes cached tokens; TokenUsage
 * counts cache reads separately, so they are subtracted back out here.
 */
function parseTokenCount(payload: Json): AgentEvent[] {
  const info = asObject(payload['info'])
  const total = info ? asObject(info['total_token_usage']) : null
  if (!total) return []
  const inputTokens = asNumber(total['input_tokens']) ?? 0
  const cachedInputTokens = asNumber(total['cached_input_tokens']) ?? 0
  const cumulativeUsage: TokenUsage = {
    inputTokens: Math.max(0, inputTokens - cachedInputTokens),
    outputTokens: asNumber(total['output_tokens']) ?? 0,
    cacheReadInputTokens: cachedInputTokens,
    cacheCreationInputTokens: 0
  }
  return [{ kind: 'session-meta', timestamp: null, cumulativeUsage }]
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
