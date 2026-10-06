import { expect, test } from '@playwright/test'
import { verificationToken } from './server.js'
import { USERS } from './users.js'

const newEmail = () => `new-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`
const banner = (page) => page.getByRole('region', { name: 'Email verification' })

async function register(page, email, password = 'a-Solid-pass-42', confirm = password) {
  await page.goto('/#/login')
  await page.getByRole('tab', { name: 'Register' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(confirm)
  await page.getByRole('button', { name: 'Create account' }).click()
}

test('a visitor registers, is reminded to verify, and verifies through the emailed link', async ({ page }) => {
  const email = newEmail()
  await register(page, email)

  await expect(page).toHaveURL(/#\/$/)
  await expect(banner(page)).toContainText(email)
  await banner(page).getByRole('button', { name: 'Resend email' }).click()
  await expect(banner(page).getByRole('status')).toHaveText('Verification email sent.')

  await page.goto(`/#/verify/${verificationToken(email)}`)
  await expect(page.getByRole('heading', { name: 'Your email is verified' })).toBeVisible()
  await expect(banner(page)).toHaveCount(0)

  // Still verified after a reload (fresh session tokens).
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your email is verified' })).toBeVisible()
  await expect(banner(page)).toHaveCount(0)
})

test('registration errors appear next to the fields', async ({ page }) => {
  await register(page, newEmail(), 'a-Solid-pass-42', 'different-pass-42')
  await expect(page.locator('#reg-confirm-error')).toHaveText('Passwords do not match.')

  await register(page, USERS.customer.email)
  await expect(page.locator('#reg-email-error')).toHaveText('An account with this email already exists.')
})

test('a guest cart is kept when registering', async ({ page }) => {
  await page.goto('/#/products?search=E2E Mug')
  await page.getByRole('button', { name: 'Add E2E Mug to cart' }).click()
  await page.getByRole('button', { name: 'Close cart' }).click()

  await register(page, newEmail())
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('button', { name: /^Cart, / })).toHaveAccessibleName('Cart, 1 item in cart')
})

test('a tampered verification link is rejected', async ({ page }) => {
  await page.goto('/#/verify/not-a-real-token')
  await expect(page.getByRole('alert')).toHaveText('This link is not valid.')
})
