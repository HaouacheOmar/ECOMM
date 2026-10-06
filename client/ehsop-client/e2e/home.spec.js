import { expect, test } from '@playwright/test'
import { API, emptyCustomerCart, placeOrder } from './api.js'
import { loginAs } from './users.js'

const shelf = (page, title) => page.getByRole('region', { name: title })

// 8, or every Product if the shop has fewer (the shelf is padded with the newest ones).
async function shelfSize(request) {
  const { count } = await (await request.get(`${API}products/`)).json()
  return Math.min(8, count)
}

test('guests see a full bestsellers shelf and no recommendations', async ({ page, request }) => {
  await page.goto('/#/')
  await expect(shelf(page, 'Bestsellers').getByRole('article')).toHaveCount(await shelfSize(request))
  await expect(shelf(page, 'Recommended for you')).toHaveCount(0)
})

test('a customer is recommended products from categories they bought, never what they bought', async ({ page, request }) => {
  await placeOrder(request, 'Checkout Vase', 1) // Home decor
  await emptyCustomerCart(request)
  await loginAs(page, 'customer')

  const recommended = shelf(page, 'Recommended for you')
  await expect(recommended.getByRole('article', { name: 'Review Teapot' })).toBeVisible() // same Category
  await expect(recommended.getByRole('article', { name: 'Checkout Vase' })).toHaveCount(0)
  await expect(shelf(page, 'Bestsellers').getByRole('article')).toHaveCount(await shelfSize(request))
})
