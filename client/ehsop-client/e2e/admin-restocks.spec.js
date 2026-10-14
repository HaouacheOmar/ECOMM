import { expect, test } from '@playwright/test'
import { setStock } from './api.js'
import { loginAs } from './users.js'

// Runs on its own Product, "Restock Lamp" (stock reset to 3 by global setup), so it can't race other specs.
test('admin restocks a product, cancels the restock, and corrects stock with a reason', async ({ page, request }) => {
  const supplier = `Test supplier ${Date.now()}`
  await setStock(request, 'Restock Lamp', 3)
  await loginAs(page, 'admin')

  // A Supplier to buy from.
  await page.goto('/#/admin/suppliers/new')
  await page.getByLabel('Name').fill(supplier)
  await page.getByRole('button', { name: 'Add supplier' }).click()
  await expect(page.getByRole('heading', { name: supplier })).toBeVisible()

  // Restock from the Product page.
  await page.goto('/#/admin/products')
  await page.getByLabel('Search products').fill('Restock Lamp')
  await page.getByRole('link', { name: 'Restock Lamp' }).click()
  await expect(page.getByTestId('stock-level')).toHaveText('3')
  await page.getByRole('link', { name: 'Record restock' }).click()
  await page.getByLabel('Supplier', { exact: true }).selectOption({ label: supplier })
  await page.getByLabel('Quantity of Restock Lamp').fill('4')
  await page.getByLabel('Unit cost of Restock Lamp').fill('2000')
  await page.getByRole('button', { name: 'Record restock' }).click()
  await expect(page.getByRole('heading', { name: `Restock from ${supplier}` })).toBeVisible()
  await expect(page.getByText('Total 8 000 DA')).toBeVisible()

  // Counted for the Supplier, and the stock went up.
  await page.getByRole('link', { name: supplier }).click()
  await expect(page.getByText('Total spent 8 000 DA')).toBeVisible()
  await page.goto('/#/admin/products')
  await page.getByLabel('Search products').fill('Restock Lamp')
  await page.getByRole('link', { name: 'Restock Lamp' }).click()
  await expect(page.getByTestId('stock-level')).toHaveText('7')

  // Cancelled: the stock comes back off.
  await page.getByRole('link', { name: `Restock · ${supplier}` }).click()
  await page.getByRole('button', { name: 'Cancel restock' }).click()
  await page.getByRole('button', { name: 'Yes, cancel it' }).click()
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Restock Lamp' }).click()
  await expect(page.getByTestId('stock-level')).toHaveText('3')

  // A Stock Correction needs a reason and never goes below zero.
  await page.getByLabel('Change (+/−)').fill('-9')
  await page.getByRole('button', { name: 'Correct' }).click()
  await expect(page.getByRole('alert')).toHaveText('Stock cannot go below zero.')
  await page.getByLabel('Change (+/−)').fill('-1')
  await page.getByLabel('Reason').selectOption('Breakage')
  await page.getByRole('button', { name: 'Correct' }).click()
  await expect(page.getByTestId('stock-level')).toHaveText('2')
  // Newest first (earlier runs leave their own corrections in this Product's history).
  await expect(page.getByRole('row', { name: /Correction · Breakage/ }).first()).toContainText('-1')

  await setStock(request, 'Restock Lamp', 3)
})
