import type { AgentEvent, TokenUsage } from '../types'

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

function parseUsage(value: unknown): TokenUsage | undefined {
  const usage = asObject(value)
  if (!usage) return undefined
  const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
  return {
    inputTokens: num(usage['input_tokens']),
    outputTokens: num(usage['output_tokens']),
    cacheReadInputTokens: num(usage['cache_read_input_tokens']),
    cacheCreationInputTokens: num(usage['cache_creation_input_tokens'])
  }
}

/**
 * Claude Code logs IDE context, system reminders, and command output as
 * `type: user` entries whose text is wrapped in a tag. Those are not the
 * human speaking (ADR 0001 §5).
 */
function isInjectedContent(text: string): boolean {
  return /^\s*<[a-z][\w-]*[\s>]/i.test(text)
}

/**
 * Parse one raw Claude Code transcript line into normalized events.
 * Never throws: malformed JSON, unknown entry types, and unknown fields all
 * degrade to zero events (ADR 0001 §3).
 */
export function parseClaudeLine(line: string): AgentEvent[] {
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
  if (entry['isSidechain'] === true) return []

  switch (entry['type']) {
    case 'user':
      return parseUserEntry(entry)
    case 'assistant':
      return parseAssistantEntry(entry)
    case 'ai-title': {
      const title = asString(entry['aiTitle'])
      return title !== undefined ? [{ kind: 'session-meta', timestamp: null, title }] : []
    }
    case 'last-prompt': {
      const lastPrompt = asString(entry['lastPrompt'])
      return lastPrompt !== undefined ? [{ kind: 'session-meta', timestamp: null, lastPrompt }] : []
    }
    default:
      return []
  }
}

function parseUserEntry(entry: Json): AgentEvent[] {
  const message = asObject(entry['message'])
  if (!message) return []
  const timestamp = parseTimestamp(entry['timestamp'])
  const cwd = asString(entry['cwd'])
  const gitBranch = asString(entry['gitBranch'])
  const content = message['content']

  if (typeof content === 'string') {
    if (isInjectedContent(content)) return []
    return [{ kind: 'user-message', timestamp, text: content, cwd, gitBranch }]
  }

  if (!Array.isArray(content)) return []
  const events: AgentEvent[] = []
  for (const rawBlock of content) {
    const block = asObject(rawBlock)
    if (!block) continue
    if (block['type'] === 'tool_result') {
      events.push({ kind: 'tool-result', timestamp, isError: block['is_error'] === true })
    } else if (block['type'] === 'text') {
      const text = asString(block['text'])
      if (text !== undefined && !isInjectedContent(text)) {
        events.push({ kind: 'user-message', timestamp, text, cwd, gitBranch })
      }
    }
  }
  return events
}

function parseAssistantEntry(entry: Json): AgentEvent[] {
  const message = asObject(entry['message'])
  if (!message) return []
  const timestamp = parseTimestamp(entry['timestamp'])
  const model = asString(message['model'])
  const messageId = asString(message['id'])
  const usage = parseUsage(message['usage'])
  const content = message['content']

  if (!Array.isArray(content)) return []
  const events: AgentEvent[] = []
  for (const rawBlock of content) {
    const block = asObject(rawBlock)
    if (!block) continue
    if (block['type'] === 'text') {
      const text = asString(block['text'])
      if (text !== undefined && text.trim() !== '') {
        events.push({ kind: 'assistant-message', timestamp, text, model, messageId, usage })
      }
    } else if (block['type'] === 'tool_use') {
      const toolName = asString(block['name'])
      if (toolName === undefined) continue
      const input = asObject(block['input'])
      events.push({
        kind: 'tool-call',
        timestamp,
        toolName,
        description: input ? asString(input['description']) : undefined,
        model,
        messageId,
        usage
      })
    }
  }
  return events
}
