import { expect, test } from '@playwright/test'
import { loginAs } from './users.js'

// The demo shop (seeded by global setup) supplies months of Delivered Orders.
test('admin reads the statistics for a month, with charts that also show as tables', async ({ page }) => {
  await loginAs(page, 'admin')

  // The Dashboard's cards lead to Statistics.
  const cards = page.getByRole('region', { name: 'This month' }).or(page.getByLabel('This month'))
  await expect(cards.getByText('Revenue this month')).toBeVisible()
  await expect(cards.getByText('Low stock', { exact: true })).toBeVisible()
  await cards.getByRole('link', { name: 'Statistics' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Statistics' })).toBeVisible()

  for (const figure of ['Revenue', 'Spent', 'Gross profit', 'Delivered orders']) {
    await expect(page.locator('.stat-tile').filter({ hasText: figure }).first()).toContainText(/vs /)
  }

  // Each chart has a table view with the same figures.
  const months = page.getByRole('region', { name: 'Last 12 months' })
  await expect(months.locator('.recharts-surface')).toBeVisible()
  await months.getByRole('button', { name: 'Show table' }).click()
  await expect(months.getByRole('row')).toHaveCount(13) // header + 12 months
  await expect(page.getByRole('region', { name: 'By year' }).locator('.recharts-surface')).toBeVisible()

  // Another month.
  await page.getByLabel('Month', { exact: true }).fill('2020-01')
  await expect(page.locator('.stat-tile').filter({ hasText: 'Revenue' }).first()).toContainText('0 DA')
  await expect(page.getByRole('region', { name: 'Top sellers' })).toContainText('Nothing delivered this month.')

  await expect(page.getByRole('region', { name: /Low stock/ })).toBeVisible()
})
