"""Create the E2E database (DB_NAME, see playwright.config.js) if it doesn't exist yet.
Run from server/, before Django needs it."""
import os
import sys

import psycopg2

sys.path.insert(0, os.getcwd())  # server/, for its settings (and their .env)
from config import settings  # noqa: E402

db = settings.DATABASES['default']
conn = psycopg2.connect(dbname='postgres', user=db['USER'], password=db['PASSWORD'], host=db['HOST'], port=db['PORT'])
conn.autocommit = True
cur = conn.cursor()
cur.execute('SELECT 1 FROM pg_database WHERE datname = %s', [db['NAME']])
if not cur.fetchone():
    cur.execute('CREATE DATABASE "%s"' % db['NAME'])
