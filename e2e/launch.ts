import { _electron as electron, type ElectronApplication } from '@playwright/test'

/**
 * Launches the built app (run `npm run build` first — the e2e npm script does).
 *
 * ELECTRON_RUN_AS_NODE must not leak into the child process: IDE extension
 * hosts (VS Code) set it, and it turns the Electron binary into plain Node.
 */
export async function launchApp(): Promise<ElectronApplication> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value
  }
  return electron.launch({ args: ['.'], env })
}
