import { expect, test } from '@playwright/test'
import { makeCustomer, resetPath } from './server.js'

const OLD = 'Old-pass-2026'
const NEW = 'Brand-new-pass-77'
const newEmail = () => `new-pw-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`

async function logIn(page, email, password) {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

// A page that is signed out is sent to the login page when it opens /account.
async function expectSignedOut(page) {
  await page.goto('/#/account')
  await expect(page).toHaveURL(/#\/login$/)
}

test('a customer resets a forgotten password, which signs out their other sessions', async ({ page, browser }) => {
  const email = newEmail()
  makeCustomer(email, OLD)
  const other = await browser.newPage()
  await logIn(other, email, OLD)
  await expect(other).toHaveURL(/#\/$/)

  // The request answers the same for any email.
  await page.goto('/#/login')
  await page.getByRole('main').getByRole('link', { name: 'Forgot your password?' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  const sent = await page.getByRole('status').textContent()
  await page.reload() // a fresh form
  await page.getByLabel('Email').fill('nobody-here@e2e.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toHaveText(sent)

  const link = resetPath(email)
  await page.goto(`/#${link}`)
  await page.getByLabel('New password', { exact: true }).fill(NEW)
  await page.getByLabel('Confirm new password').fill(NEW)
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible()

  await expectSignedOut(other)
  await other.close()

  // The link only works once (reload: we are still on that link's page).
  await page.reload()
  await page.getByLabel('New password', { exact: true }).fill('Another-pass-88')
  await page.getByLabel('Confirm new password').fill('Another-pass-88')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByRole('alert')).toContainText('not valid or has expired')
  await page.getByRole('link', { name: 'Send a new link' }).click()
  await expect(page).toHaveURL(/#\/forgot$/)

  await logIn(page, email, NEW)
  await expect(page).toHaveURL(/#\/$/)
})

test('changing the password needs the current one and signs out other sessions', async ({ page, browser }) => {
  const email = newEmail()
  makeCustomer(email, OLD)
  const other = await browser.newPage()
  await logIn(other, email, OLD)
  await expect(other).toHaveURL(/#\/$/)
  await logIn(page, email, OLD)
  await expect(page).toHaveURL(/#\/$/)
  await page.goto('/#/account')

  const form = page.getByRole('form', { name: 'Change password' })
  await form.getByLabel('Current password').fill('not-it')
  await form.getByLabel('New password', { exact: true }).fill(NEW)
  await form.getByLabel('Confirm new password').fill(NEW)
  await form.getByRole('button', { name: 'Change password' }).click()
  await expect(page.locator('#current-password-error')).toHaveText('Your current password is not correct.')

  await form.getByLabel('Current password').fill(OLD)
  await form.getByRole('button', { name: 'Change password' }).click()
  await expect(form.getByRole('status')).toHaveText('Password changed. Your other sessions have been signed out.')

  await expectSignedOut(other)
  await other.close()
  // This session carries on (it got fresh tokens), even after a reload.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible()
})
