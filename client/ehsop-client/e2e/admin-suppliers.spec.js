import { expect, test } from '@playwright/test'
import { loginAs } from './users.js'

test('admin adds a supplier, makes it a usual supplier, then archives it', async ({ page }) => {
  const name = `Test supplier ${Date.now()}`
  await loginAs(page, 'admin')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Suppliers' }).click()
  await page.getByRole('link', { name: 'New supplier' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Phone').fill('0550 12 34 56')
  await page.getByRole('button', { name: 'Add supplier' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()

  // The usual supplier of a Product.
  await page.goto('/#/admin/products')
  await page.getByLabel('Search products').fill('E2E Board')
  await page.getByRole('link', { name: 'E2E Board' }).click()
  await page.getByLabel('Usual supplier (optional)').selectOption({ label: name })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  await page.reload()
  await expect(page.getByLabel('Usual supplier (optional)')).toHaveValue(/.+/)

  // Archived: hidden from the list unless asked for.
  await page.goto('/#/admin/suppliers')
  await page.getByRole('link', { name }).click()
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Archived', { exact: true })).toBeVisible()
  await page.goto('/#/admin/suppliers')
  await page.getByLabel('Search suppliers').fill(name)
  await expect(page.getByRole('link', { name })).toBeHidden()
  await page.getByLabel('Show archived').check()
  await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('Archived')
})
