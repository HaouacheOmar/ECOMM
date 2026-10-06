# Research: free/cheap hosting for ECOMM (Django Channels, Postgres, Redis, media, React build)

Resolves issue #2. Researched 2026-10-06 against official pricing/docs pages. Prices and limits change often; re-check the linked page before you commit to a host.

## Stack being hosted

From `docx/IMPLEMENTATION.md`:
- An ASGI Django 6 app with Django Channels 4 and a `channels_redis` layer for WebSockets
- PostgreSQL, which needs CHECK constraints, so SQLite is not a substitute
- Redis as the channel layer, plus the Celery broker
- Celery and Celery Beat for async jobs and for precomputing trending products/recommendations
- Product photos (user-uploaded media)
- A React (Vite) static build using `HashRouter`

## TL;DR recommendation

**$0 portfolio setup (recommended):**

| Piece | Host | Why |
|---|---|---|
| Django ASGI + WebSockets | **Render free web service** | WebSockets supported. Sleeps after 15 min idle, cold start about 1 min |
| Postgres | **Neon free** | Permanent free plan. Render's free Postgres expires after 30 days |
| Redis (channel layer, cache) | **Render free Key Value** | Same network as the app, no per-command quota. In-memory only, which is fine for a channel layer and cache |
| Media | **Cloudinary free** (or **Cloudflare R2**) via `django-storages` / `cloudinary-storage` | Render's filesystem is ephemeral, so uploads disappear on deploy, restart or spin-down |
| React build | **Cloudflare Pages** (or GitHub Pages) | `HashRouter` needs no SPA rewrite rules, so any static host works |

**Drop Celery and Celery Beat for the demo.** Render free has no background workers or cron jobs. Options:
- Run the "heavy" tasks inline. At demo scale they are cheap.
- Compute trending products lazily, cached in Redis with a TTL.
- If a schedule really matters, use a GitHub Actions `schedule:` workflow that calls a protected endpoint or management command.

Keep the task functions plain so Celery can be added back later without a rewrite.

**About $5/mo if you want always-on and real Celery:** **Railway Hobby** ($5/mo, includes $5 of usage). Web, worker, beat, Postgres and Redis can all run in one project, and a volume (up to 5 GB) can hold media. Nothing sleeps. A small stack can go somewhat over the $5 included usage, because RAM is billed at $10/GB-month.

## Compute hosts (Django ASGI + WebSockets)

| Host | Free tier | WebSockets | Filesystem | Workers / cron on free | Cheapest paid | Portfolio fit |
|---|---|---|---|---|---|---|
| **Render** | 750 instance-hours/month per workspace. Spins down after 15 min with no inbound traffic, cold start "about one minute" [1] | Yes. WebSocket messages count as traffic for spin-down purposes [1] | Ephemeral. Lost on redeploy, restart or spin-down. No persistent disk on free [1] | No. Only web services, Postgres, Key Value and static sites have free instances [1] | Starter web service $7/mo, Starter background worker $7/mo [2][3] | **Best $0 option.** The cold start is the main downside |
| **Railway** | Trial: one-time $5 grant, up to 30 days. Then the Free plan gives $1 credit/month with 0.5 GB RAM, 1 vCPU, 1 replica, 0.5 GB volume [4][5] | Yes (standard containers) | Ephemeral, plus volumes (0.5 GB free, 5 GB Hobby) [4] | Any service type, but $1/month of credit is not enough for a full stack | Hobby $5/mo including $5 usage. RAM $10/GB-mo, vCPU $20/vCPU-mo, volume $0.15/GB-mo [4] | **Best cheap option** if Celery stays |
| **Fly.io** | No free tier. Trial is 2 machine-hours or 7 days, whichever comes first [6] | Yes | Ephemeral, plus volumes at $0.15/GB-mo [6] | n/a | shared-cpu-1x: 256 MB $2.19/mo, 512 MB $3.69/mo. Managed Postgres from $38/mo [6] | Cheap compute, but Managed Postgres costs too much. Pair it with Neon |
| **Koyeb** | 1 free instance (512 MB, 0.1 vCPU) in Frankfurt or Washington. Scales to zero after 1 h without traffic. Cannot run Worker services or use Volumes [7] | A WebSocket can wake the service, but "that connection may only live for a few minutes" [8] | Ephemeral on free | No | eco-nano $1.61/mo, nano $2.68/mo [7] | Free Postgres is 5 h compute [9]. The WebSocket caveat is a bad fit for live updates |
| **PythonAnywhere** | Free "Beginner": 1 web app, outbound internet only to whitelisted sites, no scheduled or always-on tasks, no Postgres [10] | ASGI is **experimental**: CLI-only, no static file mappings, Daphne advised against [11] | Persistent (512 MB) | No | Developer $10/mo [10] | **Poor fit** for Channels and Redis |
| **Heroku** | **No free dynos** [12] | Yes | Ephemeral | n/a | Eco $5/mo (sleeps after 30 min idle). Postgres Essential-0 $5/mo. Key-Value Mini $3/mo (25 MB) [12] | About $13/mo minimum. Railway is cheaper |

## Managed Postgres

| Provider | Free tier | Expiry / sleep | Cheapest paid |
|---|---|---|---|
| **Neon** | 1 GB per project, 100 CU-hours per project, up to 100 projects [13] | **Permanent**, "not a trial". Compute suspends after 5 min idle and this cannot be turned off, so expect a short wake-up delay [13] | Launch: usage-based, $0.106/CU-hour plus $0.35/GB-month, no minimum [13] |
| **Supabase** | 500 MB DB, 1 GB file storage, 2 active projects [14] | Paused after 1 week of inactivity [14] | Pro from $25/mo [14] |
| **Render Postgres (free)** | 1 GB, one per workspace, no backups [1] | **Expires 30 days after creation**, deleted after a 14-day grace period [1] | Basic-256mb $6/mo plus storage [2][3] |
| **Koyeb Postgres (free)** | 0.25 vCPU, 1 GB RAM, 1 GB storage, 5 h compute [9] | Scale-to-zero | Small $29.76/mo [9] |

**Pick Neon.** Use its pooled connection string, and set `CONN_MAX_AGE` low or 0, because the compute suspends while idle.

## Redis

| Provider | Free tier | Caveats for this stack | Cheapest paid |
|---|---|---|---|
| **Render Key Value (free)** | One per workspace [1] | In-memory only, so all data is lost on restart [1]. That is acceptable for a channel layer and cache, and not acceptable for a durable Celery queue | Starter 256 MB $10/mo [2][3] |
| **Upstash** | 256 MB, **500K commands/month**, 10 GB bandwidth [15] | Billed per command. Celery workers "poll Redis continuously, even when there is no queue activity" [16]. `channels_redis`'s default `RedisChannelLayer` also receives by polling (`BZPOPMIN`) [17]. Both can use up the free quota while the app sits idle | PAYG $0.20 per 100K commands. Fixed plans from $10/mo, which Upstash recommends for Celery [15][16] |
| **Redis Cloud** | 30 MB, single DB [18] | Small, but enough for a channel layer | Essentials from $5/mo minimum [18] |
| **Heroku Key-Value** | none | | Mini $3/mo, 25 MB, 20 connections [12] |

`channels_redis` supports TLS `rediss://` URLs [17]. `RedisPubSubChannelLayer` uses push-based pub/sub, which avoids constant polling, but it is still **Beta** and "can drop messages in the event of a network partition" [17].

## Media (product photos)

Every free compute option above has an **ephemeral filesystem**, so `MEDIA_ROOT` on local disk cannot be used in production.

| Provider | Free tier | Cheapest paid |
|---|---|---|
| **Cloudinary** | 25 credits/month, no card needed. 1 credit = 1 GB storage, or 1 GB bandwidth, or 1,000 transformations [19] | Plus $99/mo [19] |
| **Cloudflare R2** | 10 GB-month storage, 1M Class A and 10M Class B operations per month, **zero egress fees** [20] | Usage-based [20] |
| **Railway volume** | 0.5 GB on Free, 5 GB on Hobby [4] | $0.15/GB-mo [4] |

Cloudinary gives free resizing and thumbnails, which suits product photos. R2 is plain S3-compatible storage that works through `django-storages`.

## React (Vite) build with HashRouter

With `HashRouter` every route is `/#/...`, so the host only ever serves `index.html`. **No SPA rewrite or 404 fallback config is needed** on any static host. Set `VITE_API_URL` and the `wss://` URL at build time. On the Django side, configure CORS and CSRF trusted origins for the frontend domain, and add the frontend origin to `ALLOWED_HOSTS` / `AllowedHostsOriginValidator` for WebSockets.

| Host | Free tier | Caveats |
|---|---|---|
| **Cloudflare Pages** | 500 builds/month, 20,000 files, 25 MiB per asset [21] | None relevant |
| **GitHub Pages** | 1 GB site, 100 GB/month soft bandwidth, 10 builds/hour soft [22] | The ToS forbids using it to run an online business or e-commerce [22]. A portfolio demo is not a business, but Cloudflare Pages avoids the question |
| **Vercel Hobby** | 100 GB transfer [23] | "Non-commercial, personal use only" [23] |
| **Netlify Free** | 300 credits. Bandwidth is 20 credits/GB, about 15 GB [24] | Credit-based |
| **Render static site** | Free [1] | Same dashboard as the API |

## Decision notes for the map (#1)

1. **Celery and Celery Beat:** drop them for the portfolio deployment unless you pay for Railway, because no $0 host runs a worker. They are also the main threat to free Redis command quotas.
2. **Cold starts:** a Render free service takes about 1 min to wake on the first visit [1]. Neon adds a short delay for its own wake-up [13]. Put a "waking server..." state in the React app, or accept the delay.
3. **Order of upgrades** if the demo needs to stay warm:
   - Render Starter, $7/mo [2][3]
   - or move everything to Railway Hobby, about $5 to 10/mo

## Sources

1. Render, Deploy for Free: https://render.com/docs/free
2. Render, Pricing: https://render.com/pricing
3. Render, Hosting Django in Production (first-party article quoting plan prices): https://render.com/articles/django-production-deployment
4. Railway, Plans: https://docs.railway.com/reference/pricing/plans
5. Railway, Free Trial: https://docs.railway.com/reference/pricing/free-trial
6. Fly.io, Pricing: https://docs.fly.io/about/pricing
7. Koyeb, Instances: https://www.koyeb.com/docs/reference/instances
8. Koyeb, Scale-to-Zero: https://www.koyeb.com/docs/run-and-scale/scale-to-zero
9. Koyeb, Pricing: https://www.koyeb.com/pricing
10. PythonAnywhere, Pricing: https://www.pythonanywhere.com/pricing/
11. PythonAnywhere, ASGI (experimental): https://help.pythonanywhere.com/pages/ASGICommandLine/
12. Heroku, Pricing: https://www.heroku.com/pricing/
13. Neon, Pricing: https://neon.com/pricing
14. Supabase, Pricing: https://supabase.com/pricing
15. Upstash, Redis Pricing: https://upstash.com/pricing/redis
16. Upstash, Celery with Upstash Redis: https://upstash.com/docs/redis/integrations/celery
17. channels_redis README: https://github.com/django/channels_redis
18. Redis Cloud, Pricing: https://redis.io/pricing/
19. Cloudinary, Pricing: https://cloudinary.com/pricing
20. Cloudflare R2, Pricing: https://developers.cloudflare.com/r2/pricing/
21. Cloudflare Pages, Limits: https://developers.cloudflare.com/pages/platform/limits/
22. GitHub Pages, Limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
23. Vercel, Hobby plan: https://vercel.com/docs/plans/hobby
24. Netlify, Pricing: https://www.netlify.com/pricing/
