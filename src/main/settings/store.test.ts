import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings, SettingsStore } from './store'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agentdeck-settings-'))
  file = join(dir, 'nested', 'settings.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('parseSettings', () => {
  it('returns defaults for garbage', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS)
  })

  it('fills missing fields and drops unknown ones (forward/backward migration)', () => {
    const parsed = parseSettings({
      version: 99,
      futureFeature: { x: 1 },
      notifications: { awaitingInput: false, alsoUnknown: true }
    })
    expect(parsed).toEqual({
      version: 1,
      notifications: { awaitingInput: false, stalled: false, done: false }
    })
  })

  it('ignores mistyped fields', () => {
    const parsed = parseSettings({ notifications: { awaitingInput: 'yes', stalled: 1 } })
    expect(parsed.notifications).toEqual(DEFAULT_SETTINGS.notifications)
  })
})

describe('SettingsStore', () => {
  it('serves defaults when no file exists', () => {
    expect(new SettingsStore(file).get()).toEqual(DEFAULT_SETTINGS)
  })

  it('serves defaults when the file is corrupt', () => {
    writeFileSync(join(dir, 'settings.json'), '{not json')
    expect(new SettingsStore(join(dir, 'settings.json')).get()).toEqual(DEFAULT_SETTINGS)
  })

  it('persists updates (creating parent directories) and reloads them', () => {
    const store = new SettingsStore(file)
    store.update((s) => ({ ...s, notifications: { ...s.notifications, done: true } }))

    expect(new SettingsStore(file).get().notifications.done).toBe(true)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(store.get())
  })
})
