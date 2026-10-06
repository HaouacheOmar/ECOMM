from django.core.management.base import BaseCommand

from demo import seed


class Command(BaseCommand):
    help = 'Fill the shop with demo data (idempotent). --reset removes the demo data first and rebuilds it.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Remove the demo data and seed it again from scratch.')

    def handle(self, *args, reset=False, **options):
        if reset:
            seed.reset()
        elif seed.is_seeded():
            self.stdout.write('Demo data is already there (use --reset to rebuild it).')
            return
        seed.seed()
        self.stdout.write(self.style.SUCCESS(
            f'Demo shop ready. Log in with any of {", ".join(seed.DEMO_LOGINS.values())} / {seed.PASSWORD}'))
