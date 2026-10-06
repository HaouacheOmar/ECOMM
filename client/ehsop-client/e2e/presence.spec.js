import { expect, test } from '@playwright/test'
import { loginAs } from './users.js'

const staffRow = (page) => page.getByRole('list', { name: 'Staff presence' }).getByRole('listitem').filter({ hasText: 'employee@e2e.test' })

test('the admin dashboard shows an employee going online and offline, and their session, live', async ({ page, browser }) => {
  await loginAs(page, 'admin')
  // Any desk from an earlier test has gone Offline by now (2 s grace in E2E).
  await expect(staffRow(page)).toContainText('Offline', { timeout: 10000 })

  const desk = await browser.newPage()
  await loginAs(desk, 'employee')

  await expect(staffRow(page)).toContainText('Online')
  await expect(page.getByRole('list', { name: 'Recent sessions' }).getByRole('listitem').first()).toContainText('logged in')

  // Closing the desk: Offline once the grace period has passed, no reload needed.
  await desk.close()
  await expect(staffRow(page)).toContainText('Offline', { timeout: 10000 })
})
