"""The demo shop: people, Products with photos and Cost prices, Suppliers and Restocks, Pickup Points,
six months of Orders, Reviews, chats and Employee Sessions. Deterministic (one seeded random generator), so a reset always rebuilds the
same shop; times are relative to now so the data always looks recent."""

import random
import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.core.files import File
from django.db import transaction
from django.db.models import Avg, Count, Q
from django.utils import timezone

from accounts.models import EmployeeSession, User
from chat.models import ChatMessage
from orders.models import Order, OrderItem, PickupPoint
from products.models import Category, Product, ProductImage, Review
from products.recommendations import BESTSELLERS_KEY, recommendations_key
from stock.models import Restock, RestockLine, StockCorrection, Supplier

from .catalog import ARCHIVED, CATEGORIES, PRODUCTS

DOMAIN = 'demo.eshop.dz'
PASSWORD = 'demo-pass-2026'
PHOTOS = Path(__file__).parent / 'photos'

ADMIN = ('admin', 'Amel', 'Haddad')
EMPLOYEES = [('amina', 'Amina', 'Benali'), ('karim', 'Karim', 'Ziani'), ('yacine', 'Yacine', 'Boudiaf')]  # Yacine: deactivated
CUSTOMERS = [
    ('sara', 'Sara', 'Meziane'), ('mehdi', 'Mehdi', 'Rahmani'), ('lina', 'Lina', 'Bouzid'), ('walid', 'Walid', 'Khelifi'),
    ('nour', 'Nour', 'Saidi'), ('rania', 'Rania', 'Belkacem'), ('samir', 'Samir', 'Hamdi'), ('yasmine', 'Yasmine', 'Ait Ali'),
    ('adel', 'Adel', 'Ferhat'), ('imane', 'Imane', 'Larbi'), ('farid', 'Farid', 'Cherif'), ('meriem', 'Meriem', 'Touati'),
    ('hichem', 'Hichem', 'Mansouri'), ('kenza', 'Kenza', 'Djebbar'), ('anis', 'Anis', 'Brahimi'),
]
# Who the "Try as ..." buttons sign in as.
DEMO_LOGINS = {'CUSTOMER': f'sara@{DOMAIN}', 'EMPLOYEE': f'amina@{DOMAIN}', 'ADMIN': f'admin@{DOMAIN}'}

PICKUP_POINTS = [
    ('Hydra Relay Point', 'Algiers', '14 Rue Mohamed Khoudi, Hydra'),
    ('Bab Ezzouar Relay Point', 'Algiers', 'Centre commercial Bab Ezzouar, niveau 1'),
    ('Oran Front de Mer', 'Oran', '5 Boulevard de la Soummam'),
    ('Constantine Centre', 'Constantine', '22 Rue Larbi Ben M\'hidi'),
    ('Annaba Cours de la Revolution', 'Annaba', '9 Cours de la Revolution'),
]
ADDRESSES = [
    '12 Rue Didouche Mourad, Alger Centre', '3 Cite 1000 Logements, Bab Ezzouar, Alger', '27 Boulevard Zighout Youcef, Alger',
    '8 Rue Larbi Tebessi, Oran', '41 Cite El Bahia, Bir El Djir, Oran', '15 Rue Abane Ramdane, Constantine',
    '6 Cite Sidi Mabrouk, Constantine', '19 Rue Ibn Khaldoun, Annaba', '2 Lotissement Belaid, Tizi Ouzou', '33 Rue de la Liberte, Blida',
]
REVIEW_TEXTS = [
    'Exactly as pictured, and it arrived well packed.', 'Lovely quality for the price.', 'Beautiful, I bought a second one as a gift.',
    'Good, but smaller than I expected.', 'The colour is a little darker in person.', 'Solid and well made. Recommended.',
    'Took a week to arrive, but worth the wait.', 'My favourite purchase this year.', 'Nice, though the finish has small flaws.',
    'Does the job. Nothing special.', 'Not what I hoped for, returned to the shop to exchange it.', 'Great value, fast delivery.',
]
CHATS = [  # (customer, Employee, [(from_customer, text)]): past conversations, all answered
    ('mehdi', 'amina', [(True, 'Hello, is the cast iron skillet suitable for induction?'), (False, 'Hello Mehdi! Yes, it works on every hob, induction included.'), (True, 'Perfect, thank you.')]),
    ('lina', 'karim', [(True, 'Can I change the pickup point of my order?'), (False, 'Of course. Which office would suit you better?'), (True, 'Oran Front de Mer, please.'), (False, 'Done! You will get a message when it arrives.')]),
    ('rania', 'amina', [(True, 'The rug I received has a loose thread.'), (False, 'Sorry about that, Rania. Could you send a photo? We will replace it.'), (True, 'Sent by email just now.'), (False, 'Thanks, a replacement ships tomorrow.')]),
    ('adel', 'karim', [(True, 'Do you deliver to Tizi Ouzou?'), (False, 'Yes, Home Delivery covers all 58 wilayas, cash on delivery.')]),
]
# One Supplier per Category (the Usual Supplier of its Products), plus one the shop stopped using.
SUPPLIERS = {
    'Kitchen': ('Atlas Ceramics', '0550 21 34 87', 'Zone industrielle, Ouled Yaich, Blida', 'Delivers on Tuesdays.'),
    'Home decor': ('Maison Kasbah Decor', '0661 48 02 19', '7 Rue Ahmed Bouzrina, Casbah, Algiers', 'Hand-made pieces: allow two weeks.'),
    'Textiles': ('Tissages du Djurdjura', '0770 15 66 43', 'Route de Fort National, Tizi Ouzou', 'Minimum order 10 pieces per model.'),
    'Bags': ('Cuirs de Ghardaia', '0552 90 11 28', 'Rue du Ksar, Ghardaia', ''),
    'Stationery': ('Papeterie El Bahia', '0698 33 70 05', '12 Boulevard Emir Abdelkader, Oran', ''),
}
FORMER_SUPPLIER = ('Sahel Import Export', '0540 00 12 12', 'Port d\'Alger, Algiers', 'Stopped: late deliveries.')
ORDER_DAYS = 180   # Orders and Restocks span about six months
ORDERS = 300

WAITING = ('walid', ['Hi, my order has been "Shipped" for four days. Any news?', 'It is order for the leather tote.'])
UNREAD_FOR_AMINA = ('nour', 'Thanks for the help yesterday! One more question about the vase sizes.')
SIMULATED_MESSAGES = [
    'Hello, do you have the linen tablecloth in other sizes?', 'When will the copper kettle be back in stock?',
    'Can I pay by card on delivery?', 'Is it possible to gift-wrap my order?', 'How long does delivery to Annaba take?',
    'I would like to cancel my last order, please.', 'Is the leather tote real leather?', 'Hi! Which pickup point is closest to Hydra?',
]


def email(handle):
    return f'{handle}@{DOMAIN}'


def is_seeded():
    return User.objects.filter(email=email(ADMIN[0])).exists()


@transaction.atomic
def reset():
    """Remove everything the demo created (and Orders that touch it); Categories stay (shared)."""
    people = User.objects.filter(email__endswith=f'@{DOMAIN}')
    products = Product.objects.filter(name__in=[p[1] for p in PRODUCTS])
    points = PickupPoint.objects.filter(name__in=[p[0] for p in PICKUP_POINTS])
    Order.objects.filter(Q(customer__in=people) | Q(items__product__in=products) | Q(pickup_point__in=points)).distinct().delete()
    suppliers = Supplier.objects.filter(email__endswith=f'@{DOMAIN}')
    Restock.objects.filter(Q(supplier__in=suppliers) | Q(lines__product__in=products)).distinct().delete()
    StockCorrection.objects.filter(product__in=products).delete()
    for image in ProductImage.objects.filter(product__in=products):
        image.image.delete(save=False)
    cache.delete_many([BESTSELLERS_KEY, *[recommendations_key(pk) for pk in people.values_list('pk', flat=True)]])
    products.delete()
    points.delete()
    people.delete()
    suppliers.delete()


@transaction.atomic
def seed():
    rng = random.Random(2026)
    now = timezone.now()

    hashed = make_password(PASSWORD)  # everyone shares it; hashing once keeps seeding fast

    def person(handle, first, last, role, **extra):
        admin = role == User.Role.ADMIN
        return User.objects.create(email=email(handle), password=hashed, first_name=first, last_name=last, role=role,
                                   is_email_verified=True, is_staff=admin, is_superuser=admin,
                                   last_login=now - timedelta(days=rng.randint(0, 6)), **extra)

    person(*ADMIN, User.Role.ADMIN)
    staff = {h: person(h, f, l, User.Role.EMPLOYEE, is_active=(h != 'yacine')) for h, f, l in EMPLOYEES}
    customers = {h: person(h, f, l, User.Role.CUSTOMER) for h, f, l in CUSTOMERS}

    categories = {name: Category.objects.get_or_create(name=name)[0] for name in CATEGORIES}
    suppliers = seed_suppliers()
    products = []
    for age, (slug, name, category, price, stock, description) in enumerate(PRODUCTS):
        cost = Decimal(round(price * rng.uniform(0.45, 0.62), -1))
        product = Product.objects.create(name=name, category=categories[category], price=Decimal(price), cost_price=cost, stock=stock,
                                         usual_supplier=suppliers[category], description=description, is_archived=name in ARCHIVED)
        Product.objects.filter(pk=product.pk).update(created_at=now - timedelta(days=90 + age * 2))  # first listed = newest
        with open(PHOTOS / f'{slug}.webp', 'rb') as photo:
            ProductImage.objects.create(product=product, is_primary=True, image=File(photo, name=f'{slug}.webp'))
        products.append(product)
    points = [PickupPoint.objects.create(name=n, city=c, address=a) for n, c, a in PICKUP_POINTS]

    seed_orders(rng, now, list(customers.values()), products, points)
    seed_restocks(rng, now, products)
    seed_reviews(rng, now, list(customers.values()), [p for p in products if not p.is_archived])
    seed_chats(rng, now, customers, staff)
    seed_sessions(rng, now, staff)
    cache.delete(BESTSELLERS_KEY)  # computed from the new Orders on the next read


def seed_orders(rng, now, customers, products, points):
    """About 300 Orders over six months, busier lately: old ones mostly Delivered (some Cancelled),
    recent ones still moving, so every status is present. Each line keeps the Cost price."""
    for n in range(ORDERS):
        days_ago = ORDER_DAYS * rng.random() ** 1.4 if n >= 6 else rng.uniform(0, 1.5)  # a few very recent ones
        created = now - timedelta(days=days_ago)
        if days_ago < 1:
            status = rng.choice([Order.Status.CONFIRMED, Order.Status.CONFIRMED, Order.Status.SHIPPED])
        elif days_ago < 5:
            status = rng.choice([Order.Status.SHIPPED, Order.Status.DELIVERED, Order.Status.CONFIRMED, Order.Status.CANCELLED])
        else:
            status = Order.Status.CANCELLED if rng.random() < 0.1 else Order.Status.DELIVERED
        # A few popular Products sell much more, so the Bestsellers have a clear top.
        picks = rng.sample(products, k=rng.choice([1, 1, 2, 3]))
        if rng.random() < 0.35:
            picks = [rng.choice(products[:6])] + picks
        lines = {p.pk: (p, rng.choice([1, 1, 1, 2])) for p in picks}.values()
        pickup = rng.random() < 0.6
        order = Order.objects.create(
            customer=rng.choice(customers), status=status,
            delivery_method=Order.DeliveryMethod.PICKUP_POINT if pickup else Order.DeliveryMethod.HOME_DELIVERY,
            pickup_point=rng.choice(points) if pickup else None, delivery_address='' if pickup else rng.choice(ADDRESSES),
            total_amount=sum(p.price * q for p, q in lines),
        )
        delivered = created + timedelta(days=min(rng.uniform(1, 4), days_ago * 0.9)) if status == Order.Status.DELIVERED else None
        cancelled = created + timedelta(hours=rng.uniform(1, 20)) if status == Order.Status.CANCELLED else None
        Order.objects.filter(pk=order.pk).update(created_at=created, delivered_at=delivered, cancelled_at=cancelled)
        OrderItem.objects.bulk_create(
            OrderItem(order=order, product=p, quantity=q, price_at_purchase=p.price, cost_at_purchase=p.cost_price) for p, q in lines)


def seed_suppliers():
    """{Category name: its Supplier}, plus an archived former Supplier."""
    def make(name, phone, address, notes, **extra):
        handle = name.lower().split()[0]
        return Supplier.objects.create(name=name, phone=phone, email=f'sales.{handle}@{DOMAIN}', address=address, notes=notes, **extra)

    make(*FORMER_SUPPLIER, is_archived=True)
    return {category: make(*details) for category, details in SUPPLIERS.items()}


def seed_restocks(rng, now, products):
    """About one Restock a month per Supplier over six months, a few lines each at about the Cost
    price, and one Cancelled Restock. (They add to the history, not to the catalog's stock levels.)"""
    today = timezone.localdate(now)
    by_supplier = {}
    for product in products:
        if not product.is_archived:
            by_supplier.setdefault(product.usual_supplier, []).append(product)
    restocks = []
    for supplier, supplied in by_supplier.items():
        for _ in range(6):
            restock = Restock.objects.create(supplier=supplier, date=today - timedelta(days=rng.randint(1, ORDER_DAYS)))
            RestockLine.objects.bulk_create(
                RestockLine(restock=restock, product=p, quantity=rng.choice([3, 4, 5, 6, 8, 10]),
                            unit_cost=(p.cost_price * Decimal(rng.choice(['0.95', '1', '1', '1', '1.05']))).quantize(Decimal('1')))
                for p in rng.sample(supplied, k=min(len(supplied), rng.randint(2, 4))))
            restocks.append(restock)
    mistaken = rng.choice(restocks)
    Restock.objects.filter(pk=mistaken.pk).update(cancelled_at=now - timedelta(days=rng.uniform(0, 3)), note='Entered twice by mistake.')


def seed_reviews(rng, now, customers, products):
    """About 150 Reviews, mostly positive, some Products noticeably weaker; then the averages."""
    weak = set(rng.sample([p.pk for p in products], k=4))
    pairs = rng.sample([(c, p) for c in customers for p in products], k=150)
    for customer, product in pairs:
        weights = [3, 4, 4, 3, 1] if product.pk in weak else [1, 1, 3, 8, 10]  # ratings 1..5
        review = Review.objects.create(product=product, customer=customer, rating=rng.choices([1, 2, 3, 4, 5], weights)[0],
                                       text=rng.choice(REVIEW_TEXTS) if rng.random() < 0.6 else '')
        Review.objects.filter(pk=review.pk).update(updated_at=now - timedelta(days=rng.uniform(0, 55)))
    for product in products:
        totals = product.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
        Product.objects.filter(pk=product.pk).update(
            rating_avg=Decimal(totals['avg'] or 0).quantize(Decimal('0.01')), review_count=totals['count'])


def seed_chats(rng, now, customers, staff):
    def say(customer, sender, receiver, body, at, read=True):
        message = ChatMessage.objects.create(sender=sender, receiver=receiver, customer=customer, body=body,
                                             is_read=read, client_id=str(uuid.UUID(int=rng.getrandbits(128))))
        ChatMessage.objects.filter(pk=message.pk).update(created_at=at)

    for handle, employee_handle, lines in CHATS:
        customer, employee = customers[handle], staff[employee_handle]
        User.objects.filter(pk=customer.pk).update(assigned_employee=employee)
        start = now - timedelta(days=rng.uniform(1, 20))
        for i, (from_customer, body) in enumerate(lines):
            at = start + timedelta(minutes=4 * i)
            say(customer, customer if from_customer else employee, employee if from_customer else customer, body, at)

    # Nour's Assigned Employee hasn't read her latest message yet.
    nour, amina = customers[UNREAD_FOR_AMINA[0]], staff['amina']
    User.objects.filter(pk=nour.pk).update(assigned_employee=amina)
    say(nour, amina, nour, 'Happy to help, Nour!', now - timedelta(days=1, minutes=5))
    say(nour, nour, amina, UNREAD_FOR_AMINA[1], now - timedelta(hours=2), read=False)

    # Walid is waiting in the Support Queue for any Employee.
    walid = customers[WAITING[0]]
    for i, body in enumerate(WAITING[1]):
        say(walid, walid, None, body, now - timedelta(minutes=6 - i), read=False)
    User.objects.filter(pk=walid.pk).update(queued_at=now - timedelta(minutes=6))


def seed_sessions(rng, now, staff):
    """Weekday shifts over the last two weeks for the active Employees; older ones for Yacine."""
    def shift(employee, day, start_hour):
        login = (now - timedelta(days=day)).replace(hour=start_hour, minute=rng.randint(0, 25), second=0, microsecond=0)
        session = EmployeeSession.objects.create(employee=employee)
        EmployeeSession.objects.filter(pk=session.pk).update(
            login_at=login, logout_at=login + timedelta(hours=rng.uniform(6.5, 8.5)))

    for day in range(1, 15):
        if (now - timedelta(days=day)).weekday() in (4, 5):  # the Algerian weekend: Friday and Saturday
            continue
        shift(staff['amina'], day, 8)
        shift(staff['karim'], day, rng.choice([9, 13]))
    for day in range(20, 30, 2):
        shift(staff['yacine'], day, 9)
