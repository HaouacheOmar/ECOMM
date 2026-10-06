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

# Leftovers from earlier Admin-catalog runs.
from products.models import Category, Product
for leftover in Product.objects.filter(name__startswith='Admin test '):
    for img in leftover.images.all():
        img.image.delete(save=False)
    leftover.delete()
Category.objects.filter(name__startswith='Test category ').delete()

# A small deterministic catalog, all names prefixed "E2E" so tests can isolate it.
from decimal import Decimal
from products.models import Category, Product
kitchen, _ = Category.objects.get_or_create(name='Kitchen')
bags, _ = Category.objects.get_or_create(name='Bags')
for name, category, price, stock, archived in [
    ('E2E Mug', kitchen, '1200', 5, False),
    ('E2E Tote', bags, '2500', 0, False),
    ('E2E Board', kitchen, '3800', 3, False),
    ('E2E Archived Lamp', kitchen, '900', 4, True),
]:
    Product.objects.update_or_create(name=name, defaults={
        'category': category, 'price': Decimal(price), 'stock': stock, 'is_archived': archived,
        'description': f'{name} for end-to-end tests.',
    })
`
  execFileSync(PYTHON, ['manage.py', 'shell', '-c', script], { cwd, stdio: 'inherit' })
}
