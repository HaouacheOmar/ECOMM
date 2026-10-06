import { expect, test } from '@playwright/test'
import { resetReviews } from './server.js'
import { loginAs } from './users.js'

const PRODUCT = 'Review Teapot' // out of stock: still reviewable

async function openProduct(page) {
  await page.goto(`/#/products?search=${encodeURIComponent(PRODUCT)}`)
  await page.getByRole('article', { name: PRODUCT }).getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1, name: PRODUCT })).toBeVisible()
}

// The visible star is the radio button's label.
const star = (form, n) => form.locator('label').filter({ hasText: new RegExp(`^${n} stars?$`) })
const reviews = (page) => page.getByRole('region', { name: 'Reviews' })

test.beforeEach(() => resetReviews(PRODUCT))

test('a customer reviews a product, then edits the review instead of adding one', async ({ page }) => {
  await loginAs(page, 'customer')
  await openProduct(page)
  await expect(reviews(page)).toContainText('No reviews yet.')

  const form = page.getByRole('form', { name: 'Write a review' })
  await star(form, 4).click()
  await form.getByLabel(/Your review/).fill('Pours well, lid rattles a little.')
  await form.getByRole('button', { name: 'Post review' }).click()

  await expect(reviews(page)).toContainText('4.0 out of 5 · 1 review')
  await expect(page.getByRole('status').filter({ hasText: 'Thanks!' })).toHaveText('Thanks! Your review is saved.')
  await expect(reviews(page).getByRole('listitem')).toHaveCount(1)
  await expect(reviews(page).getByRole('listitem')).toContainText('Pours well, lid rattles a little.')
  await expect(page.getByLabel('Rated 4.0 out of 5 from 1 review')).toBeVisible()

  // Coming back shows their review ready to edit; saving again edits it.
  await page.reload()
  const edit = page.getByRole('form', { name: 'Edit your review' })
  await expect(edit.getByLabel(/Your review/)).toHaveValue('Pours well, lid rattles a little.')
  await star(edit, 2).click()
  await edit.getByLabel(/Your review/).fill('The lid broke.')
  await edit.getByRole('button', { name: 'Update review' }).click()

  await expect(reviews(page)).toContainText('2.0 out of 5 · 1 review')
  await expect(reviews(page).getByRole('listitem')).toHaveCount(1)
  await expect(reviews(page).getByRole('listitem')).toContainText('The lid broke.')
})

test('guests are invited to log in to review, and staff cannot review', async ({ page }) => {
  await openProduct(page)
  await expect(page.getByRole('form', { name: 'Write a review' })).toHaveCount(0)
  await reviews(page).getByRole('link', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/#\/login$/)

  await loginAs(page, 'admin')
  await openProduct(page)
  await expect(reviews(page)).toContainText('No reviews yet.')
  await expect(page.getByRole('form', { name: 'Write a review' })).toHaveCount(0)
  await expect(reviews(page).getByRole('link', { name: 'Log in' })).toHaveCount(0)
})
