import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { App } from 'electron'
import { installSecurityPolicy, isAllowedNavigation } from './security'

describe('isAllowedNavigation', () => {
  it('allows the packaged file:// bundle', () => {
    expect(isAllowedNavigation('file:///app/out/renderer/index.html')).toBe(true)
  })

  it('allows the dev server when configured', () => {
    expect(isAllowedNavigation('http://localhost:5173/', 'http://localhost:5173')).toBe(true)
  })

  it('blocks external urls', () => {
    expect(isAllowedNavigation('https://evil.example')).toBe(false)
    expect(isAllowedNavigation('http://localhost:5173/')).toBe(false) // no dev server configured
  })
})

class FakeWebContents extends EventEmitter {
  permissionHandler:
    ((wc: unknown, permission: string, cb: (granted: boolean) => void) => void) | null = null
  session = {
    setPermissionRequestHandler: (
      handler: (wc: unknown, permission: string, cb: (granted: boolean) => void) => void
    ): void => {
      this.permissionHandler = handler
    }
  }
}

function createHardenedContents(): FakeWebContents {
  const app = new EventEmitter()
  installSecurityPolicy(app as unknown as App, 'http://localhost:5173')
  const contents = new FakeWebContents()
  app.emit('web-contents-created', {}, contents)
  return contents
}

describe('installSecurityPolicy', () => {
  it('prevents navigation to external urls but not to our own UI', () => {
    const contents = createHardenedContents()

    const blocked = { preventDefault: vi.fn() }
    contents.emit('will-navigate', blocked, 'https://evil.example')
    expect(blocked.preventDefault).toHaveBeenCalled()

    const allowed = { preventDefault: vi.fn() }
    contents.emit('will-navigate', allowed, 'http://localhost:5173/sessions')
    expect(allowed.preventDefault).not.toHaveBeenCalled()
  })

  it('prevents webview attachment', () => {
    const contents = createHardenedContents()
    const event = { preventDefault: vi.fn() }
    contents.emit('will-attach-webview', event)
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('denies all permission requests', () => {
    const contents = createHardenedContents()
    const granted = vi.fn()
    contents.permissionHandler?.({}, 'notifications', granted)
    expect(granted).toHaveBeenCalledWith(false)
  })
})

describe('renderer CSP', () => {
  it('index.html ships a restrictive Content-Security-Policy', () => {
    const html = readFileSync(join(__dirname, '../renderer/index.html'), 'utf8')
    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html).toContain("default-src 'self'")
    expect(html).toContain("script-src 'self'")
  })
})
