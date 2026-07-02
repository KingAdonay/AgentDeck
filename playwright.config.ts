import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // One Electron app instance at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    trace: 'retain-on-failure'
  }
})
