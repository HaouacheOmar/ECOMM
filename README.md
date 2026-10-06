# E-Shop

A full-stack shop for home and lifestyle goods, priced in Algerian dinar (DA), with three workspaces:

- **Storefront** (Customers and Guests): catalog with search and Categories, Cart drawer, checkout with cash on delivery to a home address or a Pickup Point, My Orders updating live, Reviews, Bestsellers and personal Recommendations, and a support chat bubble.
- **Support desk** (Employees): the Support Queue and their Customers, the live conversation, that Customer's Orders, and the full Orders list. Employees ship, deliver or cancel Orders.
- **Admin**: a live dashboard (Order feed, which Employees are Online, recent activity), Orders, Products and photos, Categories, Pickup Points, Employees and their activity log.

Built with Django, Django REST Framework and Channels (WebSockets), Celery and Redis, and PostgreSQL. The frontend is React 19 with Vite, Redux Toolkit / RTK Query, React-Bootstrap themed for light and dark, and Motion.

## Run it locally

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```sh
cp server/.env.example server/.env            # then set DEMO_MODE=1 for the demo below
docker compose up -d                          # PostgreSQL, Redis, Django, Vite, Celery worker and Beat
docker compose exec backend python manage.py seed_demo
```

Open **http://localhost:5173**. The API and its docs are at http://localhost:8000/api/docs/.

Code is mounted into the containers, so Django and Vite reload on edits. After changing Celery task code, run `docker compose restart celery-worker celery-beat`.

### Demo

`seed_demo` fills the shop with 30 Products with photos, 5 Pickup Points, 15 Customers, 3 Employees (one deactivated), about 120 Orders over 60 days in every status, 150 Reviews, chat histories with one Customer waiting in the Support Queue, and two weeks of Employee Sessions. Running it again changes nothing. `seed_demo --reset` rebuilds the demo data from scratch.

With `DEMO_MODE=1` in `server/.env` (restart the containers after changing it):

- the login page offers **Try as Customer / Employee / Admin**;
- every ~45 seconds a demo Customer places an Order or writes to support, so the Admin dashboard and the desk move on their own.

Demo accounts (password `demo-pass-2026` for all):

| Role | Email |
|---|---|
| Admin | `admin@demo.eshop.dz` |
| Employee | `amina@demo.eshop.dz`, `karim@demo.eshop.dz` |
| Customer | `sara@demo.eshop.dz` (and 14 more `@demo.eshop.dz` Customers) |

Your own Admin: `docker compose exec backend python manage.py createsuperuser`.

Product photos are from [Unsplash](https://unsplash.com) (see [server/demo/photos/CREDITS.md](server/demo/photos/CREDITS.md)).

## Tests

```sh
# Backend (needs PostgreSQL and Redis from docker compose)
cd server && python -m pytest

# Frontend end-to-end (Playwright). Starts its own Django (port 8001) and Vite (5174) against a
# separate eshop_e2e database, so it never touches your dev data.
cd client/ehsop-client && npm install && npm run e2e
```

CI (GitHub Actions) runs both suites, the frontend lint and build, and a migration check on every pull request.
