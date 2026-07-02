import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface NotificationPrefs {
  /** Agent finished its turn and is waiting on the human. The headline feature. */
  awaitingInput: boolean
  /** Agent was working but went quiet mid-turn (working → idle). */
  stalled: boolean
  /** Session aged out entirely. Noisy; off by default. */
  done: boolean
}

export interface Settings {
  version: 1
  notifications: NotificationPrefs
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  notifications: { awaitingInput: true, stalled: false, done: false }
}

/**
 * Coerce anything found on disk into a valid Settings object: unknown fields
 * are dropped, missing or mistyped fields fall back to defaults. This doubles
 * as the migration story — old files are re-interpreted, never rejected.
 */
export function parseSettings(raw: unknown): Settings {
  const root = isObject(raw) ? raw : {}
  const notifications = isObject(root['notifications']) ? root['notifications'] : {}
  return {
    version: 1,
    notifications: {
      awaitingInput: bool(
        notifications['awaitingInput'],
        DEFAULT_SETTINGS.notifications.awaitingInput
      ),
      stalled: bool(notifications['stalled'], DEFAULT_SETTINGS.notifications.stalled),
      done: bool(notifications['done'], DEFAULT_SETTINGS.notifications.done)
    }
  }
}

export class SettingsStore {
  private settings: Settings

  constructor(private readonly filePath: string) {
    this.settings = this.read()
  }

  get(): Settings {
    return this.settings
  }

  update(mutate: (current: Settings) => Settings): Settings {
    this.settings = parseSettings(mutate(this.settings))
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2) + '\n')
    return this.settings
  }

  private read(): Settings {
    try {
      return parseSettings(JSON.parse(readFileSync(this.filePath, 'utf8')))
    } catch {
      return DEFAULT_SETTINGS
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}
