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
    user.role, user.is_active, user.is_email_verified = role, True, True
    user.set_password(${JSON.stringify(PASSWORD)})
    user.save()

# Accounts registered by earlier runs.
User.objects.filter(email__startswith='new-', email__endswith='@e2e.test').delete()
User.objects.filter(email__startswith='staff-', email__endswith='@e2e.test').delete()

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

# Checkout fixtures, outside the "E2E" catalog so catalog specs are unaffected; stock reset every run.
decor, _ = Category.objects.get_or_create(name='Home decor')
for name, stock in [('Checkout Vase', 50), ('Checkout Candle', 1), ('Review Teapot', 0)]:
    Product.objects.update_or_create(name=name, defaults={
        'category': decor, 'price': Decimal('2000'), 'stock': stock, 'is_archived': False,
    })
from orders.models import PickupPoint
PickupPoint.objects.filter(name__startswith='Test pickup ').delete()
PickupPoint.objects.update_or_create(name='E2E Hydra office', defaults={
    'city': 'Algiers', 'address': '12 Rue Didouche Mourad', 'is_active': True,
})
`
  execFileSync(PYTHON, ['manage.py', 'shell', '-c', script], { cwd, stdio: 'inherit' })
  // The demo shop too (a no-op once seeded), for the "Try as ..." and simulated-activity specs.
  execFileSync(PYTHON, ['manage.py', 'seed_demo'], { cwd, stdio: 'inherit' })
}
