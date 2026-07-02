import type { SessionState, TokenUsage } from './domain'

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens
  }
}

/** Everything sent to the model, including cache writes and reads. */
export function totalInputTokens(usage: TokenUsage): number {
  return usage.inputTokens + usage.cacheCreationInputTokens + usage.cacheReadInputTokens
}

export function totalTokens(usage: TokenUsage): number {
  return totalInputTokens(usage) + usage.outputTokens
}

export function aggregateUsage(states: readonly SessionState[]): TokenUsage {
  return states.reduce((sum, state) => addUsage(sum, state.usage), EMPTY_USAGE)
}
