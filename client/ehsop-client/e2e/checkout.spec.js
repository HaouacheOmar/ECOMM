import { expect, test } from '@playwright/test'
import { emptyCustomerCart, findProduct, updateProduct } from './api.js'
import { PASSWORD, USERS, loginAs } from './users.js'

const drawer = (page) => page.getByRole('dialog', { name: 'Your cart' })
const confirmButton = (page) => page.getByRole('button', { name: 'Confirm order' })
const stockOf = async (request, name) => (await findProduct(request, name)).stock

async function addToCart(page, name, times = 1) {
  await page.goto(`/#/products?search=${encodeURIComponent(name)}`)
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: `Add ${name} to cart` }).click()
    await page.getByRole('button', { name: 'Close cart' }).click()
  }
}

async function goToCheckout(page) {
  await page.getByRole('button', { name: /^Cart, / }).click()
  await drawer(page).getByRole('link', { name: 'Checkout', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible()
}

test.beforeEach(async ({ request }) => {
  await emptyCustomerCart(request)
})

test('a customer checks out with a pickup point, sees the order, and cancels it', async ({ page, request }) => {
  const before = await stockOf(request, 'Checkout Vase')
  await loginAs(page, 'customer')
  await addToCart(page, 'Checkout Vase', 2)
  await goToCheckout(page)

  await page.getByRole('combobox', { name: 'Pickup Point' }).selectOption({ label: 'Algiers: E2E Hydra office, 12 Rue Didouche Mourad' })
  await expect(page.getByRole('region', { name: 'Order summary' })).toContainText('4 000 DA')
  await confirmButton(page).click()

  await expect(page).toHaveURL(/#\/orders$/)
  await expect(page.getByRole('status').filter({ hasText: 'Order placed' })).toBeVisible()
  const order = page.getByRole('listitem', { name: /^Order / }).first()
  await expect(order).toContainText('Confirmed')
  await expect(order).toContainText('2 × 2 000 DA')
  await expect(order).toContainText('Pickup Point: E2E Hydra office')
  await expect(page.getByRole('button', { name: /^Cart, / })).toHaveAccessibleName('Cart, 0 items in cart')
  expect(await stockOf(request, 'Checkout Vase')).toBe(before - 2)

  page.once('dialog', (dialog) => dialog.accept())
  await order.getByRole('button', { name: 'Cancel order' }).click()
  await expect(order).toContainText('Cancelled')
  await expect(order.getByRole('button', { name: 'Cancel order' })).toHaveCount(0)
  expect(await stockOf(request, 'Checkout Vase')).toBe(before)
})

test('an item that sells out during checkout is marked unavailable', async ({ page, request }) => {
  await loginAs(page, 'customer')
  await addToCart(page, 'Checkout Candle')
  await goToCheckout(page)
  await page.getByRole('combobox', { name: 'Pickup Point' }).selectOption({ label: 'Algiers: E2E Hydra office, 12 Rue Didouche Mourad' })

  await updateProduct(request, 'Checkout Candle', { stock: 0 })
  try {
    await confirmButton(page).click()
    await expect(page.getByRole('alert')).toContainText('Some items sold out')
    await expect(page.getByRole('note')).toHaveText('Sold out. Remove it to continue.')
    await expect(confirmButton(page)).toBeDisabled()
  } finally {
    await updateProduct(request, 'Checkout Candle', { stock: 1 })
  }
})

test('a guest is sent to log in at checkout and comes back to it with their cart', async ({ page }) => {
  await addToCart(page, 'Checkout Vase')
  await page.getByRole('button', { name: /^Cart, / }).click()
  await drawer(page).getByRole('link', { name: 'Checkout', exact: true }).click()

  await expect(page).toHaveURL(/#\/login$/)
  await page.getByLabel('Email').fill(USERS.customer.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/#\/checkout$/)

  // Home Delivery needs an address.
  await page.getByRole('radio', { name: /Home Delivery/ }).check()
  await confirmButton(page).click()
  await expect(page.locator('#delivery-address-error')).toHaveText('Enter the delivery address.')

  await page.getByLabel('Delivery address').fill('5 Rue Larbi Ben Mhidi, Algiers')
  await confirmButton(page).click()
  await expect(page).toHaveURL(/#\/orders$/)
  await expect(page.getByRole('listitem', { name: /^Order / }).first()).toContainText('Home Delivery to 5 Rue Larbi Ben Mhidi, Algiers')
})

test('the admin manages pickup points', async ({ page }) => {
  const name = `Test pickup ${Date.now()}`
  await loginAs(page, 'admin')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Pickup Points' }).click()

  const form = page.getByRole('form', { name: 'New pickup point' })
  await form.getByLabel('Name').fill(name)
  await form.getByLabel('City').fill('Oran')
  await form.getByLabel('Address').fill('3 Boulevard Front de Mer')
  await form.getByRole('button', { name: 'Add' }).click()

  const row = page.getByRole('form', { name })
  await expect(row.getByLabel('City')).toHaveValue('Oran')
  await row.getByLabel('Active').click()
  await expect(row.getByLabel('Active')).not.toBeChecked()

  await row.getByRole('button', { name: `Delete ${name}` }).click()
  await expect(row).toHaveCount(0)
})
