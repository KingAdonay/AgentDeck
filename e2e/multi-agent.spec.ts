import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp } from './launch'

const claudeFixtures = join(
  __dirname,
  '..',
  'src',
  'main',
  'agents',
  'claude-code',
  '__fixtures__',
  'projects'
)
const codexFixtures = join(
  __dirname,
  '..',
  'src',
  'main',
  'agents',
  'codex-cli',
  '__fixtures__',
  'sessions'
)

test('renders Claude Code and Codex CLI sessions on one board', async () => {
  const app = await launchApp({
    AGENTDECK_CLAUDE_PROJECTS_DIR: claudeFixtures,
    AGENTDECK_CODEX_SESSIONS_DIR: codexFixtures
  })
  try {
    const page = await app.firstWindow()

    await expect(page.getByTestId('session-card')).toHaveCount(4)
    await expect(page.getByTestId('project-group')).toHaveCount(3)

    // The Codex session groups under its real cwd (from session_meta, not the
    // date-directory path) and shows its transcript content.
    await expect(page.getByRole('heading', { name: /dev\/api-service/ })).toBeVisible()
    await page.getByText('Add rate limiting to the public API endpoints').click()
    const panel = page.getByTestId('detail-panel')
    await expect(panel.getByText('⎇ feat/rate-limit')).toBeVisible()
    await expect(
      panel.getByTestId('timeline-event').filter({ hasText: 'rg limiter src' })
    ).toBeVisible()
  } finally {
    await app.close()
  }
})
