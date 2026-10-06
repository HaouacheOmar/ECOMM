import { expect, test } from '@playwright/test'
import { findProduct, placeOrder } from './api.js'
import { loginAs } from './users.js'

const number = (order) => `Order ${order.id.slice(0, 8).toUpperCase()}`

async function openOrder(page, order) {
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Orders' }).click()
  await page.getByLabel('Search by customer email').fill('customer@e2e.test')
  await page.getByRole('link', { name: number(order) }).click()
  await expect(page.getByRole('heading', { level: 1, name: number(order) })).toBeVisible()
}

test('the admin ships then delivers an order, and the customer sees it', async ({ page, browser, request }) => {
  const order = await placeOrder(request, 'Checkout Vase', 1)
  await loginAs(page, 'admin')
  await openOrder(page, order)
  const badge = page.locator('.status-badge')

  await expect(badge).toHaveText('Confirmed')
  await page.getByRole('button', { name: 'Mark as shipped' }).click()
  await expect(badge).toHaveText('Shipped')
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Mark as delivered' }).click()
  await expect(badge).toHaveText('Delivered')
  await expect(page.getByRole('button', { name: /^Mark as / })).toHaveCount(0)

  // The list's status filter finds it.
  await page.getByRole('link', { name: 'All orders' }).click()
  await page.getByRole('button', { name: 'Delivered', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: number(order) })).toContainText('Delivered')

  const customer = await browser.newPage()
  await loginAs(customer, 'customer')
  await customer.goto('/#/orders')
  const card = customer.getByRole('listitem', { name: number(order) })
  await expect(card).toContainText('Delivered')
  await card.getByRole('button').first().click()
  await expect(card.getByRole('button', { name: 'Cancel order' })).toHaveCount(0)
  await customer.close()
})

test('the admin cancels a confirmed order and its stock comes back', async ({ page, request }) => {
  const order = await placeOrder(request, 'Checkout Vase', 2)
  const before = (await findProduct(request, 'Checkout Vase')).stock
  await loginAs(page, 'admin')
  await openOrder(page, order)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await expect(page.locator('.status-badge')).toHaveText('Cancelled')
  expect((await findProduct(request, 'Checkout Vase')).stock).toBe(before + 2)
})

for (const scheme of ['light', 'dark']) {
  test(`status badges keep their label and colour in the ${scheme} theme`, async ({ page, request }) => {
    const order = await placeOrder(request, 'Checkout Vase', 1)
    await page.emulateMedia({ colorScheme: scheme })
    await loginAs(page, 'admin')
    await openOrder(page, order)

    const colours = {}
    for (const [move, label] of [[null, 'Confirmed'], ['Mark as shipped', 'Shipped'], ['Mark as delivered', 'Delivered']]) {
      if (move) await page.getByRole('button', { name: move }).click()
      const badge = page.locator('.status-badge')
      await expect(badge).toHaveText(label)
      colours[label] = await badge.evaluate((el) => getComputedStyle(el).backgroundColor)
    }
    expect(new Set(Object.values(colours)).size).toBe(3)
  })
}
