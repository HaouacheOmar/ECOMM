import { expect, test } from '@playwright/test'
import { loginAs, PASSWORD, USERS } from './users.js'

test('admin logs in, lands on /admin, survives a reload and logs out', async ({ page }) => {
  await loginAs(page, 'admin')
  await expect(page).toHaveURL(/#\/admin$/)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page).toHaveURL(/#\/admin$/)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/#\/login$/)
  await page.goto('/#/admin')
  await expect(page).toHaveURL(/#\/login$/)
})

test('each role lands in its own workspace', async ({ page }) => {
  await loginAs(page, 'employee')
  await expect(page).toHaveURL(/#\/desk$/)
  await page.getByRole('button', { name: 'Log out' }).click()

  await loginAs(page, 'customer')
  await expect(page).toHaveURL(/#\/$/)
})

test('workspaces redirect other roles to their own home', async ({ page }) => {
  await loginAs(page, 'customer')
  await expect(page).toHaveURL(/#\/$/)
  await page.goto('/#/admin')
  await expect(page).toHaveURL(/#\/$/)
  await page.goto('/#/desk')
  await expect(page).toHaveURL(/#\/$/)
})

test('anonymous users are sent to login and returned to the page they asked for', async ({ page }) => {
  await page.goto('/#/admin/orders')
  await expect(page).toHaveURL(/#\/login$/)
  await page.getByLabel('Email').fill(USERS.admin.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/#\/admin\/orders$/)
})

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill(USERS.admin.email)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toContainText('No active account')
})

test('an expired access token is refreshed transparently mid-session', async ({ page }) => {
  await loginAs(page, 'admin')
  await expect(page).toHaveURL(/#\/admin$/)

  // The E2E backend issues 5-second access tokens.
  await page.waitForTimeout(6000)
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh/') && r.status() === 200)
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Account' }).click()

  await refreshed
  await expect(page.getByText(`Signed in as ${USERS.admin.email}`)).toBeVisible()
})
