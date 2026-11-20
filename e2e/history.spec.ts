import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { launchApp, tempHistoryDb } from './launch'

const fixtureRoot = join(
  __dirname,
  '..',
  'src',
  'main',
  'agents',
  'claude-code',
  '__fixtures__',
  'projects'
)

async function openHistory(page: Page): Promise<void> {
  await page.getByTestId('view-history').click()
  // Fixture sessions are months old; widen past the default 30-day window.
  await page.getByTestId('history-range').selectOption('all')
}

test('task history outlives the transcripts it was recorded from', async () => {
  const historyDb = tempHistoryDb()

  // 1. With transcripts on disk, the startup replay records every session.
  const first = await launchApp({
    AGENTDECK_CLAUDE_PROJECTS_DIR: fixtureRoot,
    AGENTDECK_HISTORY_DB: historyDb
  })
  const page = await first.firstWindow()
  await expect(page.getByTestId('session-card')).toHaveCount(3)
  await openHistory(page)
  // The recorder flushes on an interval; the view refreshes on its clock tick.
  await expect(page.getByTestId('history-row')).toHaveCount(3, { timeout: 30_000 })
  await expect(page.getByText('Add dark mode toggle')).toBeVisible()

  await page.getByTestId('history-search').fill('dark mode')
  await expect(page.getByTestId('history-row')).toHaveCount(1)
  await first.close()

  // 2. Transcripts gone (agent logout / retention) — history still lists them.
  const emptyProjects = mkdtempSync(join(tmpdir(), 'agentdeck-e2e-empty-'))
  const second = await launchApp({
    AGENTDECK_CLAUDE_PROJECTS_DIR: emptyProjects,
    AGENTDECK_HISTORY_DB: historyDb
  })
  const secondPage = await second.firstWindow()
  await expect(secondPage.getByTestId('onboarding')).toBeVisible()
  await openHistory(secondPage)
  await expect(secondPage.getByTestId('history-row')).toHaveCount(3)
  await expect(secondPage.getByText('Add dark mode toggle')).toBeVisible()
  await second.close()
})
