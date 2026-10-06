export const PASSWORD = 'e2e-pass-12345'

export const USERS = {
  admin: { email: 'admin@e2e.test', role: 'ADMIN' },
  employee: { email: 'employee@e2e.test', role: 'EMPLOYEE' },
  customer: { email: 'customer@e2e.test', role: 'CUSTOMER' },
}

export async function loginAs(page, who) {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill(USERS[who].email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
}
