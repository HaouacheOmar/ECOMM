import { expect, test } from '@playwright/test'
import { loginAs } from './users.js'

const theme = (page) => page.locator('html').getAttribute('data-bs-theme')

test('storefront shell renders the search and the icon rail', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('search')).toBeVisible()
  const rail = page.getByRole('navigation', { name: 'Shop' })
  await expect(rail.getByRole('link', { name: 'My Orders' })).toBeVisible()
  await expect(rail.getByRole('link', { name: 'Log in' })).toBeVisible()
  await expect(rail.getByRole('button', { name: /Cart/ })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('Cash on delivery')
})

test('employee desk shell renders the three panes', async ({ page }) => {
  await loginAs(page, 'employee')
  await expect(page.getByRole('region', { name: 'Support Queue and my Customers' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conversation' })).toBeVisible()
  await expect(page.getByRole('region', { name: "Customer's Orders" })).toBeVisible()
})

test('admin shell icon rail navigates between sections', async ({ page }) => {
  await loginAs(page, 'admin')
  const rail = page.getByRole('navigation', { name: 'Admin' })
  await rail.getByRole('link', { name: 'Orders' }).click()
  await expect(page).toHaveURL(/#\/admin\/orders$/)
  await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible()
})

test.describe('theme', () => {
  test('defaults to the system preference', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()
    await page.goto('/#/')
    expect(await theme(page)).toBe('dark')
    await context.close()
  })

  test('toggle overrides the system and persists across reloads', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' })
    const page = await context.newPage()
    await page.goto('/#/')
    expect(await theme(page)).toBe('light')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    expect(await theme(page)).toBe('dark')
    await page.reload()
    expect(await theme(page)).toBe('dark')
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
    await context.close()
  })
})

test('route changes still work with reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await loginAs(page, 'admin')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Employees' }).click()
  await expect(page.getByRole('heading', { name: /employees/i })).toBeVisible()
  await context.close()
})
