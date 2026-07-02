export function relativeTime(timestamp: number | null, now: number): string {
  if (timestamp === null) return '—'
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** '/Users/jane/dev/web-app' → 'dev/web-app' */
export function shortenPath(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.slice(-2).join('/') || path
}

/** 'claude-opus-4-8' → 'opus-4-8' */
export function shortModel(model: string): string {
  return model.replace(/^claude-/, '')
}

export function formatTokens(count: number): string {
  if (count < 1000) return String(count)
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`
  return `${(count / 1_000_000).toFixed(1)}M`
}

export function formatDuration(first: number | null, last: number | null): string | null {
  if (first === null || last === null || last <= first) return null
  const minutes = Math.round((last - first) / 60_000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
