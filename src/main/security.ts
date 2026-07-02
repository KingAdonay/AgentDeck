import type { App } from 'electron'

/**
 * The renderer may only ever display our own UI: the packaged file:// bundle
 * or the Vite dev server. Everything else opens in the system browser (see
 * setWindowOpenHandler) or is blocked.
 */
export function isAllowedNavigation(url: string, devServerUrl?: string): boolean {
  if (url.startsWith('file://')) return true
  if (devServerUrl !== undefined && devServerUrl !== '' && url.startsWith(devServerUrl)) return true
  return false
}

/**
 * App-wide hardening, applied to every WebContents ever created:
 * no external navigation, no <webview>, no permission grants (camera,
 * geolocation, notifications-from-renderer, ...). AgentDeck's renderer
 * never needs any of these.
 */
export function installSecurityPolicy(
  app: App,
  devServerUrl = process.env['ELECTRON_RENDERER_URL']
): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!isAllowedNavigation(url, devServerUrl)) event.preventDefault()
    })

    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })

    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })
  })
}
