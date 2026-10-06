import { expect, test } from '@playwright/test'
import { emptyCustomerCart, placeOrder } from './api.js'
import { loginAs } from './users.js'

const number = (order) => `Order ${order.id.slice(0, 8).toUpperCase()}`

// E2E access tokens last 5 s, so after this every socket has been closed at expiry (4001) and
// must have refreshed and reconnected on its own.
const OUTLIVE_TOKEN = 7000

// Marks the page so we can prove an update arrived without a reload.
const mark = (page) => page.evaluate(() => { window.__noReload = true })
const notReloaded = async (page) => expect(await page.evaluate(() => window.__noReload)).toBe(true)

test('a new order appears live on the admin dashboard and the employee orders list', async ({ page, browser, request }) => {
  await loginAs(page, 'admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()

  const desk = await browser.newPage()
  await loginAs(desk, 'employee')
  await desk.getByRole('navigation', { name: 'Desk' }).getByRole('link', { name: 'Orders' }).click()
  await expect(desk.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible()

  await mark(page)
  await mark(desk)
  await page.waitForTimeout(OUTLIVE_TOKEN)

  const order = await placeOrder(request, 'Checkout Vase', 1)

  const feed = page.getByRole('list', { name: 'Order feed' })
  await expect(feed.getByRole('listitem').first()).toContainText(number(order))
  await expect(feed.getByRole('listitem').first()).toContainText('Confirmed')
  await expect(desk.getByRole('row').filter({ hasText: number(order) })).toContainText('customer@e2e.test')
  await notReloaded(page)
  await notReloaded(desk)
  await desk.close()
})

test('an employee ships an order and the customer sees it live in My Orders', async ({ page, browser, request }) => {
  const order = await placeOrder(request, 'Checkout Vase', 1)
  await emptyCustomerCart(request)

  await loginAs(page, 'customer')
  await page.goto('/#/orders')
  const card = page.getByRole('listitem', { name: number(order) })
  await expect(card).toContainText('Confirmed')
  await mark(page)

  const desk = await browser.newPage()
  await loginAs(desk, 'employee')
  await desk.getByRole('navigation', { name: 'Desk' }).getByRole('link', { name: 'Orders' }).click()
  await desk.getByRole('link', { name: number(order) }).click()
  await page.waitForTimeout(OUTLIVE_TOKEN)

  await desk.getByRole('button', { name: 'Mark as shipped' }).click()
  await expect(card).toContainText('Shipped')
  await desk.getByRole('button', { name: 'Mark as delivered' }).click()
  await expect(card).toContainText('Delivered')
  await notReloaded(page)
  await desk.close()
})
