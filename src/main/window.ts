import type { BrowserWindowConstructorOptions } from 'electron'

/**
 * Window options live in a pure function so the security posture is
 * unit-testable without booting Electron.
 */
export function createMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  }
}
