import { expect } from '@playwright/test'

export const PASSWORD = 'e2e-pass-12345'

export const USERS = {
  admin: { email: 'admin@e2e.test', role: 'ADMIN' },
  employee: { email: 'employee@e2e.test', role: 'EMPLOYEE' },
  customer: { email: 'customer@e2e.test', role: 'CUSTOMER' },
}

const HOME = { admin: /#\/admin$/, employee: /#\/desk$/, customer: /#\/$/ }

// Logs in and waits for the role's landing page, so later navigation isn't overridden by the redirect.
export async function loginAs(page, who) {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill(USERS[who].email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(HOME[who])
}

// Opens the catalog search for `term` and waits until its results page is the one showing (the
// previous page, e.g. the home shelves, animates out first and may list the same Products).
export async function searchCatalog(page, term) {
  await page.goto(`/#/products?search=${encodeURIComponent(term)}`)
  await expect(page.getByRole('heading', { level: 1, name: `Results for “${term}”` })).toBeVisible()
}
