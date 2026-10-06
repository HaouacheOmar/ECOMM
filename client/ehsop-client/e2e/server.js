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
