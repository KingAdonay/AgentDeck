import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp } from './launch'

test('shows onboarding when no sessions exist', async () => {
  const emptyRoot = mkdtempSync(join(tmpdir(), 'agentdeck-empty-'))
  const app = await launchApp({ AGENTDECK_CLAUDE_PROJECTS_DIR: emptyRoot })
  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId('onboarding')).toBeVisible()
    await expect(page.getByTestId('onboarding')).toContainText('No agent sessions found')
    await expect(page.getByTestId('session-card')).toHaveCount(0)
  } finally {
    await app.close()
  }
})
