import { expect, test, type ElectronApplication } from '@playwright/test'
import { launchApp } from './launch'

let app: ElectronApplication

test.beforeAll(async () => {
  app = await launchApp()
})

test.afterAll(async () => {
  await app.close()
})

test('boots and renders the shell', async () => {
  const page = await app.firstWindow()
  await expect(page.getByRole('heading', { name: 'AgentDeck' })).toBeVisible()
})

test('renderer is sandboxed: no Node globals leak in', async () => {
  const page = await app.firstWindow()
  const globals = await page.evaluate(() => ({
    require: typeof (globalThis as Record<string, unknown>)['require'],
    process: typeof (globalThis as Record<string, unknown>)['process'],
    Buffer: typeof (globalThis as Record<string, unknown>)['Buffer']
  }))
  expect(globals).toEqual({ require: 'undefined', process: 'undefined', Buffer: 'undefined' })
})

test('preload bridge exposes the typed api', async () => {
  const page = await app.firstWindow()
  const versions = await page.evaluate(() => window.api.versions)
  expect(versions.electron).toMatch(/^\d+\./)
  expect(versions.chrome).toMatch(/^\d+\./)
})
