import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from './launch'

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

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  app = await launchApp({ AGENTDECK_CLAUDE_PROJECTS_DIR: fixtureRoot })
  page = await app.firstWindow()
})

test.afterAll(async () => {
  await app.close()
})

test('renders every fixture session, grouped by project', async () => {
  await expect(page.getByTestId('session-card')).toHaveCount(3)
  await expect(page.getByTestId('project-group')).toHaveCount(2)

  // Group header shows the real cwd from events, not the lossy slug guess.
  await expect(page.getByRole('heading', { name: /dev\/web-app/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /dev\/api/ })).toBeVisible()

  // The session with an AI title uses it as the card title.
  await expect(page.getByText('Add dark mode toggle')).toBeVisible()
})

test('derives status from transcript recency (old fixtures are done)', async () => {
  const badges = page.getByTestId('session-card').getByTestId('status-badge')
  await expect(badges).toHaveCount(3)
  for (const badge of await badges.all()) {
    await expect(badge).toHaveAttribute('data-status', 'done')
  }
  await expect(page.getByTestId('count-working')).toContainText('0')
  await expect(page.getByTestId('count-awaiting')).toContainText('0')
})

test('opens the session detail timeline on card click', async () => {
  await page.getByText('Add dark mode toggle').click()

  const panel = page.getByTestId('detail-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('⎇ feature/dark-mode')).toBeVisible()

  const events = panel.getByTestId('timeline-event')
  // user prompt, assistant text, tool call, final assistant text —
  // successful tool results and meta entries are filtered as noise.
  await expect(events).toHaveCount(4)
  await expect(events.first()).toContainText('Add a dark mode toggle to the settings page')
  await expect(events.nth(2)).toContainText('Read')
  await expect(events.last()).toContainText('Done — the toggle is wired up')

  await panel.getByRole('button', { name: 'Close details' }).click()
  await expect(panel).not.toBeVisible()
})
