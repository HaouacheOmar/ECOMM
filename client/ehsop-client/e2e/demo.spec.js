import { expect, test } from '@playwright/test'
import { simulateActivity } from './server.js'

// The E2E server runs with DEMO_MODE on and the demo shop seeded (see global setup).
async function tryAs(page, label) {
  await page.goto('/#/login')
  await page.getByRole('button', { name: `Try as ${label}` }).click()
}

test('the try-as buttons open each workspace as its demo user', async ({ page }) => {
  await tryAs(page, 'Customer')
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('region', { name: 'Recommended for you' }).getByRole('article').first()).toBeVisible()
  await page.getByRole('button', { name: 'Log out' }).click()

  await tryAs(page, 'Employee')
  await expect(page).toHaveURL(/#\/desk$/)
  await expect(page.getByRole('list', { name: 'Support Queue' })).toContainText('Walid Khelifi')
  await page.getByRole('button', { name: 'Log out' }).click()

  await tryAs(page, 'Admin')
  await expect(page).toHaveURL(/#\/admin$/)
  await expect(page.getByRole('list', { name: 'Staff presence' })).toContainText('Karim Ziani')
  await expect(page.getByRole('list', { name: 'Recent sessions' }).getByRole('listitem').first()).toBeVisible()
})

test('simulated orders and messages appear live on the admin dashboard and the desk', async ({ page, browser }) => {
  await tryAs(page, 'Admin')
  await expect(page).toHaveURL(/#\/admin$/)
  const desk = await browser.newPage()
  await tryAs(desk, 'Employee')
  await expect(desk).toHaveURL(/#\/desk$/)

  simulateActivity('order', 'imane@demo.eshop.dz')
  await expect(page.getByRole('list', { name: 'Order feed' }).getByRole('listitem').first()).toContainText('imane@demo.eshop.dz')

  simulateActivity('message', 'kenza@demo.eshop.dz') // no Assigned Employee: she joins the Support Queue
  await expect(desk.getByRole('list', { name: 'Support Queue' })).toContainText('Kenza Djebbar')
  await desk.close()
})
