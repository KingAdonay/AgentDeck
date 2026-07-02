import { describe, expect, it } from 'vitest'
import { createMainWindowOptions } from './window'

describe('createMainWindowOptions', () => {
  const options = createMainWindowOptions('/path/to/preload.js')

  it('enforces the security baseline', () => {
    expect(options.webPreferences).toMatchObject({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    })
  })

  it('loads the given preload script', () => {
    expect(options.webPreferences?.preload).toBe('/path/to/preload.js')
  })
})
