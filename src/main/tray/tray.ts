import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import type { SessionState } from '../../shared/domain'
import { buildTrayMenuTemplate, trayTooltip, type TrayHandlers } from './menu'

/**
 * Thin Electron wrapper over the pure menu builder.
 * Icon note: resources/ sits next to out/ in dev and is shipped via
 * extraResources when packaged. The @2x variant is picked up automatically
 * for HiDPI, and the 'Template' filename suffix lets macOS theme it.
 */
function trayIconPath(): string {
  const base = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(__dirname, '../../resources')
  return join(base, 'trayIconTemplate.png')
}

export class AppTray {
  private readonly tray: Tray

  constructor(private readonly handlers: TrayHandlers) {
    const icon = nativeImage.createFromPath(trayIconPath())
    icon.setTemplateImage(true)
    this.tray = new Tray(icon)
  }

  update(states: readonly SessionState[], now: number = Date.now()): void {
    this.tray.setToolTip(trayTooltip(states, now))
    this.tray.setContextMenu(
      Menu.buildFromTemplate(buildTrayMenuTemplate(states, now, this.handlers))
    )
  }

  destroy(): void {
    this.tray.destroy()
  }
}
