/**
 * macOS shows the menu-bar app title from CFBundleName of the *running bundle*.
 * In development that's node_modules/electron/dist/Electron.app, so every dev
 * run says "Electron". This postinstall patches the dev bundle's Info.plist to
 * "AgentDeck" and ad-hoc re-signs it (Apple Silicon refuses to launch a bundle
 * whose seal no longer matches). Packaged builds are unaffected — electron-
 * builder stamps productName into their Info.plist already.
 *
 * Safe to re-run; no-op off macOS, when electron isn't installed, or when
 * already patched. Re-applies automatically after any npm install.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const NAME = 'AgentDeck'
const PLIST_BUDDY = '/usr/libexec/PlistBuddy'

if (process.platform !== 'darwin') process.exit(0)

let electronBinary
try {
  electronBinary = createRequire(import.meta.url)('electron')
} catch {
  process.exit(0) // electron not installed yet
}
const appBundle = String(electronBinary).split('/Contents/MacOS/')[0]
const plist = `${appBundle}/Contents/Info.plist`
if (!existsSync(plist) || !existsSync(PLIST_BUDDY)) process.exit(0)

const read = (key) => {
  try {
    return execFileSync(PLIST_BUDDY, ['-c', `Print :${key}`, plist])
      .toString()
      .trim()
  } catch {
    return null
  }
}
const write = (key, value) => {
  try {
    execFileSync(PLIST_BUDDY, ['-c', `Set :${key} ${value}`, plist])
  } catch {
    execFileSync(PLIST_BUDDY, ['-c', `Add :${key} string ${value}`, plist])
  }
}

if (read('CFBundleName') === NAME && read('CFBundleDisplayName') === NAME) process.exit(0)

write('CFBundleName', NAME)
write('CFBundleDisplayName', NAME)
execFileSync('codesign', ['--force', '--sign', '-', appBundle])
console.log(`[agentdeck] dev Electron.app menu-bar name patched to "${NAME}"`)
