import { expect, test } from '@playwright/test'

const cards = (page) => page.locator('.product-grid article')
const cardNames = (page) => cards(page).locator('h2').allTextContents()

test('guest searches from the header and results update after typing', async ({ page }) => {
  await page.goto('/#/')
  await page.getByLabel('Search products').fill('E2E')
  await expect(page).toHaveURL(/#\/products\?search=E2E$/)
  await expect(page.getByRole('status')).toHaveText('3 products found')
  expect(await cardNames(page)).toEqual(expect.arrayContaining(['E2E Mug', 'E2E Tote', 'E2E Board']))
})

test('archived products are never shown', async ({ page }) => {
  await page.goto('/#/products?search=E2E')
  await expect(page.getByLabel('Search products')).toHaveValue('E2E')
  await expect(page.getByRole('status')).toHaveText('3 products found')
  await expect(page.getByText('E2E Archived Lamp')).toHaveCount(0)
})

test('filter by category and sort by price', async ({ page }) => {
  await page.goto('/#/products?search=E2E')
  await page.getByRole('group', { name: 'Categories' }).getByRole('button', { name: 'Kitchen' }).click()
  await expect(page.getByRole('status')).toHaveText('2 products found')

  await page.getByLabel('Sort by').selectOption({ label: 'Price: high to low' })
  await expect(cards(page).first()).toContainText('E2E Board')
  expect(await cardNames(page)).toEqual(['E2E Board', 'E2E Mug'])

  await page.getByLabel('Sort by').selectOption({ label: 'Price: low to high' })
  await expect(cards(page).first()).toContainText('E2E Mug')
})

test('out of stock products stay listed and are marked', async ({ page }) => {
  await page.goto('/#/products?search=E2E Tote')
  const tote = page.getByRole('article', { name: 'E2E Tote' })
  await expect(tote.getByText('Out of stock')).toBeVisible()
})

test('product page shows details', async ({ page }) => {
  await page.goto('/#/products?search=E2E Mug')
  await page.getByRole('article', { name: 'E2E Mug' }).getByRole('link').click()
  await expect(page.getByRole('heading', { name: 'E2E Mug' })).toBeVisible()
  await expect(page.getByText('1 200 DA')).toBeVisible()
  await expect(page.getByText('Only 5 left')).toBeVisible()
  await expect(page.getByText('E2E Mug for end-to-end tests.')).toBeVisible()
})
