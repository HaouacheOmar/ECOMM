import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { loginAs, searchCatalog } from './users.js'

const PHOTO = fileURLToPath(new URL('./fixtures/photo.png', import.meta.url))

test('admin creates a product with a photo, then archives and restores it', async ({ page }) => {
  const name = `Admin test ${Date.now()}`
  await loginAs(page, 'admin')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Products' }).click()
  await page.getByRole('link', { name: 'New product' }).click()

  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Description').fill('Made in the E2E workshop.')
  await page.getByLabel('Price (DA)').fill('4500')
  await page.getByLabel('Stock').fill('7')
  await page.getByLabel('Category').selectOption({ label: 'Kitchen' })
  await page.getByRole('button', { name: 'Create product' }).click()

  await expect(page.getByRole('heading', { name })).toBeVisible()
  await page.getByText('Add photo').setInputFiles(PHOTO)
  await expect(page.getByText('Primary')).toBeVisible()

  // Shown in the storefront with its photo.
  await searchCatalog(page, name)
  const card = page.getByRole('article', { name })
  await expect(card.locator('img')).toHaveAttribute('src', /\/media\/products\//)
  await expect(card).toContainText('4 500 DA')

  // Archive hides it from the storefront.
  await page.goto('/#/admin/products')
  await page.getByLabel('Search products').fill(name)
  await page.getByRole('link', { name }).click()
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Archived', { exact: true })).toBeVisible()
  await searchCatalog(page, name)
  await expect(page.getByRole('status').filter({ hasText: /found|Loading/ })).toHaveText('0 products found')

  // Still listed for the Admin, and restorable.
  await page.goto('/#/admin/products')
  await page.getByLabel('Search products').fill(name)
  await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('Archived')
  await page.getByRole('link', { name }).click()
  await page.getByRole('button', { name: 'Restore' }).click()
  await searchCatalog(page, name)
  await expect(page.getByRole('status').filter({ hasText: /found|Loading/ })).toHaveText('1 product found')
})

test('product form shows validation errors next to fields', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.goto('/#/admin/products/new')
  await page.getByLabel('Name').fill('Admin test invalid')
  await page.getByLabel('Price (DA)').fill('0')
  await page.getByRole('button', { name: 'Create product' }).click()

  await expect(page.locator('#p-price-error')).toBeVisible()
  await expect(page.locator('#p-category-error')).toBeVisible()
})

test('admin adds, renames and deletes a category; categories in use cannot be deleted', async ({ page }) => {
  const name = `Test category ${Date.now()}`
  await loginAs(page, 'admin')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Categories' }).click()

  await page.getByLabel('New category').fill(name)
  await page.getByRole('button', { name: 'Add' }).click()
  const row = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Delete ${name}`, exact: true }) })
  await expect(row).toBeVisible()

  await row.getByLabel('Category name').fill(`${name} renamed`)
  await row.getByRole('button', { name: 'Rename' }).click()
  await expect(page.locator(`input[value="${name} renamed"]`)).toBeVisible()

  await page.getByRole('button', { name: `Delete ${name} renamed` }).click()
  await expect(page.locator(`input[value="${name} renamed"]`)).toHaveCount(0)

  await page.getByRole('button', { name: 'Delete Kitchen' }).click()
  await expect(page.getByRole('alert')).toContainText('still has products')
})
