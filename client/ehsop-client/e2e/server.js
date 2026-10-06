import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PYTHON } from '../playwright.config.js'

const cwd = fileURLToPath(new URL('../../../server', import.meta.url))

// Run Python against the E2E database (for things a real user would get by email).
export function djangoShell(code) {
  const output = execFileSync(PYTHON, ['manage.py', 'shell', '-c', code], { cwd, encoding: 'utf-8' })
  // The shell may print its own notices first; the result is the last line.
  return output.trim().split(/\r?\n/).at(-1).trim()
}

export function verificationToken(email) {
  return djangoShell(`
from accounts.models import User
from accounts.verification import make_token
print(make_token(User.objects.get(email=${JSON.stringify(email)})))`)
}

// A fresh support chat for the E2E customer: no history, not waiting, no Assigned Employee.
export function resetChat() {
  djangoShell(`
from accounts.models import User
from chat.models import ChatMessage
customer = User.objects.get(email='customer@e2e.test')
ChatMessage.objects.filter(customer=customer).delete()
User.objects.filter(pk=customer.pk).update(assigned_employee=None, queued_at=None)
print('ok')`)
}

// A throwaway Customer (removed by global setup on the next run) for tests that change passwords.
export function makeCustomer(email, password) {
  djangoShell(`
from accounts.models import User
User.objects.create_user(${JSON.stringify(email)}, ${JSON.stringify(password)}, is_email_verified=True)
print('ok')`)
}

// The "/reset/<uid>/<token>" part of the link a real user would get by email.
export function resetPath(email) {
  return djangoShell(`
from accounts.models import User
from accounts.passwords import reset_link
print(reset_link(User.objects.get(email=${JSON.stringify(email)})).split('#')[1])`)
}

// No Reviews on a Product, and its rating back to zero.
export function resetReviews(name) {
  djangoShell(`
from products.models import Product
product = Product.objects.get(name=${JSON.stringify(name)})
product.reviews.all().delete()
Product.objects.filter(pk=product.pk).update(rating_avg=0, review_count=0)
print('ok')`)
}
