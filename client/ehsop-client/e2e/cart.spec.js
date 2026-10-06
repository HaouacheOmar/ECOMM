import { expect, test } from '@playwright/test'
import { emptyCustomerCart, setArchived, updateProduct } from './api.js'
import { loginAs, searchCatalog } from './users.js'

const cartButton = (page) => page.getByRole('button', { name: /^Cart, / })
const drawer = (page) => page.getByRole('dialog', { name: 'Your cart' })
const line = (page, name) => drawer(page).getByRole('listitem').filter({ hasText: name })

async function addFromCatalog(page, name) {
  await searchCatalog(page, name)
  await page.getByRole('button', { name: `Add ${name} to cart` }).click()
  await expect(drawer(page)).toBeVisible()
}

test.beforeEach(async ({ request }) => {
  await emptyCustomerCart(request)
})

test('guest cart survives a reload and merges into the customer cart at login', async ({ page }) => {
  await addFromCatalog(page, 'E2E Mug')
  await expect(line(page, 'E2E Mug')).toContainText('1 200 DA')
  await line(page, 'E2E Mug').getByRole('button', { name: 'Increase quantity of E2E Mug' }).click()
  await expect(cartButton(page)).toHaveAccessibleName('Cart, 2 items in cart')

  await page.reload()
  await expect(cartButton(page)).toHaveAccessibleName('Cart, 2 items in cart')

  await loginAs(page, 'customer')
  await cartButton(page).click()
  await expect(line(page, 'E2E Mug').getByLabel('Quantity 2')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer(page)).toBeHidden()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(cartButton(page)).toHaveAccessibleName('Cart, 0 items in cart')
})

test('the same customer cart appears in another browser', async ({ page, browser }) => {
  await loginAs(page, 'customer')
  await addFromCatalog(page, 'E2E Board')

  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await loginAs(otherPage, 'customer')
  await cartButton(otherPage).click()
  await expect(line(otherPage, 'E2E Board')).toBeVisible()
  await other.close()
})

test('quantity is capped at stock and a sold-out item blocks checkout', async ({ page, request }) => {
  await loginAs(page, 'customer')
  await searchCatalog(page, 'E2E Board')
  await page.getByRole('article', { name: 'E2E Board' }).getByRole('link').click()
  await page.getByLabel('Quantity').fill('3')
  await page.getByRole('button', { name: 'Add E2E Board to cart' }).click()
  await expect(line(page, 'E2E Board').getByRole('button', { name: 'Increase quantity of E2E Board' })).toBeDisabled()
  await expect(drawer(page).getByRole('link', { name: 'Checkout' })).toBeVisible()

  try {
    await updateProduct(request, 'E2E Board', { stock: 2 })
    await page.reload()
    await cartButton(page).click()
    await expect(line(page, 'E2E Board')).toContainText('Only 2 left')
    await expect(drawer(page).getByRole('button', { name: 'Checkout' })).toBeDisabled()

    await line(page, 'E2E Board').getByRole('button', { name: 'Decrease quantity of E2E Board' }).click()
    await expect(drawer(page).getByRole('link', { name: 'Checkout' })).toBeVisible()
  } finally {
    await updateProduct(request, 'E2E Board', { stock: 3 })
  }
})

test('archived products leave the guest cart', async ({ page, request }) => {
  await addFromCatalog(page, 'E2E Mug')
  try {
    await setArchived(request, 'E2E Mug', true)
    await page.reload()
    await cartButton(page).click()
    await expect(drawer(page)).toContainText('Your cart is empty.')
  } finally {
    await setArchived(request, 'E2E Mug', false)
  }
})

test('out of stock products cannot be added', async ({ page }) => {
  await searchCatalog(page, 'E2E Tote')
  await expect(page.getByRole('article', { name: 'E2E Tote' }).getByRole('button', { name: 'Out of stock' })).toBeDisabled()
})
