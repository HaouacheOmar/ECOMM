import { expect, test } from '@playwright/test'
import { loginAs } from './users.js'

const PASSWORD = 'Desk-pass-2026'

async function deskLogin(page, email, password) {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

async function openEmployees(page) {
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Employees' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Employees' })).toBeVisible()
}

test('the admin onboards an employee, resets their password, audits and deactivates them', async ({ page, browser }) => {
  const email = `staff-${Date.now()}@e2e.test`
  await loginAs(page, 'admin')
  await openEmployees(page)

  const form = page.getByRole('form', { name: 'New employee' })
  await form.getByLabel('First name').fill('Amina')
  await form.getByLabel('Last name').fill('Benali')
  await form.getByLabel('Email').fill(email)
  await form.getByLabel('Initial password').fill(PASSWORD)
  await form.getByRole('button', { name: 'Create employee' }).click()
  await expect(page.getByRole('status').filter({ hasText: email })).toHaveText(`${email} can now log in to the desk.`)
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: email, exact: true }) })
  await expect(row).toContainText('Active')

  // The new Employee works from the desk.
  const desk = await browser.newPage()
  await deskLogin(desk, email, PASSWORD)
  await expect(desk).toHaveURL(/#\/desk$/)
  await expect(desk.getByRole('region', { name: 'Support Queue and my Customers' })).toBeVisible()

  // Their session shows in the activity log, still open.
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Activity log' }).click()
  const session = page.getByRole('row').filter({ hasText: email }).first()
  await expect(session).toContainText('Amina Benali')
  await expect(session).toContainText('Signed in')

  // A new password replaces the old one.
  await openEmployees(page)
  await row.getByRole('button', { name: 'Set password' }).click()
  await page.getByLabel(`New password for ${email}`).fill('Brand-new-pass-77')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'New password set' })).toBeVisible()

  // Deactivation cuts the open desk off at once (its sockets are closed and it can't refresh).
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Deactivate' }).click()
  await expect(row).toContainText('Deactivated')
  await expect(desk).toHaveURL(/#\/login$/)
  await deskLogin(desk, email, 'Brand-new-pass-77')
  await expect(desk.getByRole('alert')).toBeVisible()
  await desk.close()

  // The activity log now shows when the session ended.
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Activity log' }).click()
  await expect(session).not.toContainText('Signed in')
  await expect(session.getByRole('cell').nth(2)).toHaveText(/\d{4}/)
})

test('a weak initial password is explained next to the field', async ({ page }) => {
  await loginAs(page, 'admin')
  await openEmployees(page)
  const form = page.getByRole('form', { name: 'New employee' })
  await form.getByLabel('Email').fill(`staff-weak-${Date.now()}@e2e.test`)
  await form.getByLabel('Initial password').fill('123')
  await form.getByRole('button', { name: 'Create employee' }).click()
  await expect(page.locator('#new-employee-password-error')).toBeVisible()
})
