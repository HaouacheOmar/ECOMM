import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PYTHON } from '../playwright.config.js'
import { PASSWORD, USERS } from './users.js'

// Ensure the schema exists and the E2E users have known passwords (idempotent).
export default function globalSetup() {
  const cwd = fileURLToPath(new URL('../../../server', import.meta.url))
  execFileSync(PYTHON, ['manage.py', 'migrate', '--noinput'], { cwd, stdio: 'inherit' })
  const script = `
from accounts.models import User
for email, role in ${JSON.stringify(Object.values(USERS).map((u) => [u.email, u.role]))}:
    user, _ = User.objects.get_or_create(email=email, defaults={'role': role})
    user.role, user.is_active = role, True
    user.set_password(${JSON.stringify(PASSWORD)})
    user.save()
`
  execFileSync(PYTHON, ['manage.py', 'shell', '-c', script], { cwd, stdio: 'inherit' })
}
