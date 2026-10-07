# E-Shop

A full-stack shop for home and lifestyle goods, priced in Algerian dinar (DA), with three workspaces:

- **Storefront** (Customers and Guests): catalog with search and Categories, Cart drawer, checkout with cash on delivery to a home address or a Pickup Point, My Orders updating live, Reviews, Bestsellers and personal Recommendations, and a support chat bubble.
- **Support desk** (Employees): the Support Queue and their Customers, the live conversation, that Customer's Orders, and the full Orders list. Employees ship, deliver or cancel Orders.
- **Admin**: a live dashboard (Order feed, which Employees are Online, recent activity), Orders, Products and photos, Categories, Pickup Points, Employees and their activity log.

## Highlights

- **Real time over WebSockets**: new Orders land on the Admin dashboard without a refresh, a Customer's My Orders updates the moment an Employee ships or cancels, and the desk shows which Employees are Online.
- **Support chat with a shared queue**: a Customer's first message joins the Support Queue, the first Employee to reply takes it, and the Customer stays with that Employee. If the Employee goes offline with messages still unanswered, the Customer goes back to the queue.
- **Accounts**: email login with JWT (5-minute access tokens, rotating refresh tokens, blacklist on logout), email verification, password reset and change, and three roles routed to their own workspace.
- **Background jobs**: Celery sends the emails (with retries), recomputes Bestsellers every 15 minutes and refreshes each Customer's Recommendations nightly.
- **Design system**: one set of tokens drives light and dark themes across all three workspaces; route transitions and card motion use Motion.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3.12, Django 6, Django REST Framework, SimpleJWT, drf-spectacular (OpenAPI docs) |
| Real time | Django Channels, Daphne (ASGI), Redis channel layer; sockets `ws/orders/`, `ws/chat/`, `ws/activity/` |
| Jobs | Celery worker and Celery Beat on Redis |
| Data | PostgreSQL; Redis also serves as the cache |
| Frontend | React 19, Vite, Redux Toolkit and RTK Query, React Router (HashRouter), React-Bootstrap themed with CSS variables, Motion, lucide-react |
| Testing | pytest, pytest-django, pytest-asyncio (REST and WebSocket tests), Playwright end-to-end |
| Tooling | Docker Compose for the whole stack, GitHub Actions CI, oxlint |

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
