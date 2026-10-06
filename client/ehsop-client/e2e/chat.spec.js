import { expect, test } from '@playwright/test'
import { resetChat } from './server.js'
import { loginAs } from './users.js'

const bubble = (page) => page.getByRole('button', { name: /^Support chat/ })
const panel = (page) => page.getByRole('dialog', { name: 'Support chat' })
const queue = (page) => page.getByRole('list', { name: 'Support Queue' })
const mine = (page) => page.getByRole('list', { name: 'My Customers' })

async function say(scope, text) {
  await scope.getByLabel('Message', { exact: true }).fill(text)
  await scope.getByRole('button', { name: 'Send' }).click()
}

test.beforeEach(() => resetChat())

test('a customer and an employee chat live, and the reply claims the customer', async ({ page, browser }) => {
  const desk = await browser.newPage()
  await loginAs(desk, 'employee')
  await expect(queue(desk)).toBeAttached()

  await loginAs(page, 'customer')
  await bubble(page).click()
  await say(panel(page), 'Hello, where is my vase?')
  await expect(panel(page).getByRole('listitem').filter({ hasText: 'Hello, where is my vase?' })).not.toContainText('Sending')

  // It waits in the Support Queue, which updates live on the desk.
  const waiting = queue(desk).getByRole('button', { name: /customer@e2e\.test/ })
  await expect(waiting).toBeVisible()
  await expect(waiting).toContainText('1')
  await waiting.click()
  const conversation = desk.getByRole('region', { name: 'Conversation' })
  await expect(conversation.getByRole('listitem').filter({ hasText: 'Hello, where is my vase?' })).toBeVisible()
  await expect(desk.getByRole('region', { name: "Customer's Orders" })).toBeVisible()

  // The reply reaches the Customer live and moves them from the Queue to "My Customers".
  await say(conversation, 'Hi! It ships today.')
  await expect(panel(page).getByRole('listitem').filter({ hasText: 'Hi! It ships today.' })).toContainText('employee@e2e.test')
  await expect(queue(desk).getByRole('button', { name: /customer@e2e\.test/ })).toHaveCount(0) // (other Customers may wait too)
  await expect(mine(desk).getByRole('button', { name: /customer@e2e\.test/ })).toBeVisible()

  // After both sockets outlive their 5 s tokens, a follow-up goes straight to the Assigned Employee.
  await page.waitForTimeout(7000)
  await say(panel(page), 'Thanks!')
  await expect(conversation.getByRole('listitem').filter({ hasText: 'Thanks!' })).toBeVisible()
  await expect(queue(desk).getByRole('button', { name: /customer@e2e\.test/ })).toHaveCount(0)
  await desk.close()
})

test('a reply that arrives while the chat is closed shows as unread', async ({ page, browser }) => {
  await loginAs(page, 'customer')
  await bubble(page).click()
  await say(panel(page), 'Quick question')
  await page.getByRole('button', { name: 'Close chat' }).click()

  const desk = await browser.newPage()
  await loginAs(desk, 'employee')
  await queue(desk).getByRole('button', { name: /customer@e2e\.test/ }).click()
  await say(desk.getByRole('region', { name: 'Conversation' }), 'Ask away!')

  await expect(bubble(page)).toHaveAccessibleName('Support chat, 1 unread')
  await bubble(page).click()
  await expect(panel(page)).toContainText('Ask away!')
  await expect(bubble(page)).toHaveAccessibleName('Support chat')
  await desk.close()
})
