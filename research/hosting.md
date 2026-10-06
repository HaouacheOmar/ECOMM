# Research: $0, no-credit-card hosting for ECOMM (Django Channels, Postgres, Redis, media, React build)

Resolves issue #2. Researched 2026-10-06 against official docs and pricing pages. Free tiers change often, so re-check the linked page before relying on a number.

**Constraints:**
- **$0.**
- **No credit card or payment method** at signup or for verification.
- The user has chosen **Supabase + Vercel**.

## Stack being hosted

From `docx/IMPLEMENTATION.md`:
- An ASGI Django 6 app with Django Channels 4 and `channels_redis`
- PostgreSQL, which needs CHECK constraints
- Redis as the channel layer, plus the Celery broker
- Celery and Celery Beat
- Product photos (user-uploaded media)
- A React (Vite) build using `HashRouter`

## Verdict

**Vercel (frontend + Django ASGI backend) + Supabase (Postgres + Storage) + Redis Cloud free (channel layer) works for $0 without a card, with caveats.**

| Piece | Where | Card? |
|---|---|---|
| React (Vite) static build | Vercel Hobby | No [V1][V2] |
| Django ASGI + Channels WebSockets | Vercel Hobby, Python runtime (**WebSockets are a public beta**) [V3][V4] | No |
| Postgres | Supabase Free, through the Supavisor pooler [S1][S3] | No [S2] |
| Product photos | Supabase Storage, S3-compatible through `django-storages` [S1][S5] | No |
| Channel layer (cross-instance `group_send`) | Redis Cloud free, 30 MB [R1][R2] | No [R2] |
| Celery | Drop it. If you must keep it, Celery runs on Vercel Queues, but Beat does not [V6] | No |

Fallback if the Vercel WebSocket beta does not work out: run the Django ASGI app on **Render free** and keep Vercel for the frontend. See "Alternative backend hosts". Render may ask for a card for verification.

## 1. Vercel: what it can and cannot do here

My first expectation was that Vercel Python functions cannot hold WebSockets. **That is out of date.**
- WebSocket support for Vercel Functions entered public beta in June 2026, and Python support followed in July 2026 [V4].
- Vercel's Django guide has a **"WebSockets" section that uses Django Channels** with a `ProtocolTypeRouter` ASGI entrypoint. Vercel "serves the WebSocket connection from the same Vercel Function as your Django application" [V3].

**Can:**
- Serve the React/Vite build as a static site. `HashRouter` needs no rewrite rules.
- Run Django from `ASGI_APPLICATION`. When both `ASGI_APPLICATION` and `WSGI_APPLICATION` are set, Vercel uses ASGI [V3].
- Run `collectstatic` automatically and serve static files from its CDN [V3].
- Serve Channels WebSocket consumers (beta) [V3][V5].
- Run Celery tasks through the `vercel://` broker (Vercel Queues, beta). Hobby includes the first 1,000,000 queue operations [V6][V7].
- Run daily cron jobs [V8].

**Cannot, or caveats:**
- **Connections are cut at 5 minutes.** "WebSocket connections close when a Vercel Function reaches its maximum duration", and the Hobby maximum is 300 s [V5][V9]. The React client must auto-reconnect and resubscribe.
- **No cross-instance state.** Each connection is pinned to one instance, and reconnects may land on a different one. Vercel says "`InMemoryChannelLayer` only coordinates connections within one function instance", so an external channel layer such as Redis is required [V3][V5].
- **Memory quota is the real limit.**
  - Hobby includes **360 GB-hrs of Provisioned Memory** and 4 h of Active CPU per month [V10].
  - Memory is billed for the whole lifetime of an instance while any request is in flight [V10]. An open WebSocket counts as in flight.
  - Hobby functions run at a fixed **2 GB** (default and maximum) [V9]. That gives roughly **180 instance-hours/month**.
  - A browser tab left open with an auto-reconnecting socket keeps an instance alive 24/7, which is about 730 h/month. That would use up the quota in about a week.
  - Once a Hobby limit is exceeded, "you will have to wait until 30 days have passed before you can use the feature again" [V1].
  - **Mitigation:** open the socket only on pages that need it (order feed, chat), and close it on `visibilitychange`/idle.
- **4.5 MB request body limit** [V9]. Large photo uploads through Django will fail. Either resize on the client, or upload straight to Supabase Storage with a signed upload URL issued by Django.
- **No Celery Beat.** "`celery beat` requires a long-running process. Use Vercel Cron Jobs" [V6]. Hobby cron runs **at most once per day**, with ±59 min precision [V8].
- **Beta status:** WebSockets and Queues are both beta [V4][V6]. Expect rough edges.
- **Hobby is "non-commercial, personal use only"** [V1]. A portfolio demo fits.

## 2. Supabase Free (no card)

Supabase lets you start "without first needing to put down a credit card" [S2].

| Item | Free limit |
|---|---|
| Database | 500 MB per project. 60 direct connections, 200 pooler connections [S1] |
| Projects | 2 active [S1] |
| Inactivity | **Paused after 1 week of inactivity** [S1]. You can restore with one click within 1 year [S4]. For a demo, keep it alive with any regular query (e.g. the daily Vercel cron) |
| Storage | 1 GB total, **50 MB max per file**, 5 GB egress [S1][S6] |
| Realtime | 200 concurrent connections, 2M messages/month [S1] |

### Connecting Django

- **Direct connection** (`db.<ref>.supabase.co:5432`) is **IPv6-only** unless you pay for the IPv4 add-on. The **Supavisor pooler is IPv4 on all plans** [S3]. Use the pooler.
- From Vercel (serverless), use the **transaction pooler on port 6543**, which is "for serverless and edge functions". Note that "transaction mode does not support prepared statements" [S3].
- Django settings for transaction pooling:
  - Set `"DISABLE_SERVER_SIDE_CURSORS": True`. This is required in transaction pooling mode [D1].
  - Keep psycopg 3's default client-side binding: do not set `server_side_binding: True` [D1].
  - Use `CONN_MAX_AGE = 0` and no Django `pool`. The pooler does the pooling.
- If the backend runs on a long-lived server (e.g. Render), use the session pooler on port 5432 instead [S3].

### Storage for product photos

Supabase Storage speaks the S3 protocol. Use S3 access keys from the project settings, with the endpoint `https://<project_ref>.storage.supabase.co/storage/v1/s3` [S5]. That plugs into `django-storages` (`S3Storage`) as `DEFAULT_FILE_STORAGE` / `STORAGES["default"]`. Make the bucket public so `<img>` URLs work without signing.

### Could Supabase Realtime replace Channels? (option)

Supabase Realtime offers [S7]:
- **Broadcast** ("low-latency messages between clients")
- **Presence** ("who's online")
- **Postgres Changes** ("listen to database changes")

The free plan allows 200 concurrent connections and 2M messages/month [S1].
- Order-status feed: the React app could subscribe to Postgres Changes on the orders table.
- Chat and presence: Broadcast and Presence.

That would remove Channels, Redis and the Vercel WebSocket caveats entirely. Django becomes plain HTTP, which Vercel handles well.

The cost:
- Clients need Supabase auth or RLS policies to read those channels securely.
- The "Django Channels" showcase in the portfolio goes away.

This is a valid simplification if the WebSocket beta proves fragile.

## 3. Redis for the channel layer (free, no card)

| Provider | Free | Card? | Fit for `channels_redis` |
|---|---|---|---|
| **Redis Cloud** | 30 MB, 30 concurrent connections, 100 ops/sec, 5 GB/month bandwidth, no monthly command cap [R1] | "No credit card required" [R2] | **Best.** Throughput-capped rather than count-capped |
| **Upstash** | 256 MB, **500K commands/month** [U1] | No [U1] | Risky. `RedisChannelLayer` receives with `BZPOPMIN` and a 5 s timeout (`brpop_timeout = 5`) [C1]. That is about 12 commands/min per live process, about 518K/month if a process is always up. Celery polling also eats the quota [U2] |

`channels_redis` supports `rediss://` (TLS) URLs [C1]. `RedisPubSubChannelLayer` avoids polling, but it is **beta** and "can drop messages in the event of a network partition" [C1].

## 4. Alternative backend hosts (if not Vercel)

| Host | Free tier | Card needed? | Notes |
|---|---|---|---|
| **Render** | Free web service with WebSockets. Spins down after 15 min idle, about 1 min cold start. 750 h/month. Ephemeral filesystem. **No free background workers or cron.** Free Postgres **expires after 30 days**. Free Key Value is in-memory only [RD1] | Docs do not require one [RD1], but Render may ask for card verification (a $1 hold) as an anti-abuse step [RD2] | Best non-Vercel option. Wakes on "HTTP request or new WebSocket connection" [RD1] |
| **Koyeb** | 1 free instance (512 MB, 0.1 vCPU). Scales to zero after 1 h. No workers or volumes [K1]. A WebSocket that wakes the service "may only live for a few minutes" [K2] | May ask for a card, with a $29 pre-auth hold [K3] | Weak fit |
| **Railway** | Trial: one-time $5 for up to 30 days, then $1/month credit (0.5 GB RAM) [RW1][RW2] | Trial without a card. Limited Trial (restricted networking) if GitHub verification fails [RW3] | Not sustainably free |
| **Fly.io** | No free tier. Trial is 2 machine-hours or 7 days [F1] | Card required after the trial [F2] | ✗ |
| **Heroku** | No free dynos [H1] | Card required for verification [H2] | ✗ |
| **PythonAnywhere** | Free has no Postgres, whitelisted outbound traffic, and ASGI is experimental with no static mappings [P1][P2] | No | ✗ (no Channels/Redis) |

## 5. Celery and Celery Beat

**Recommendation: drop them for the portfolio deploy.**
- Run "heavy" tasks inline. They are cheap at demo scale.
- Compute trending products lazily and cache them in Redis or the DB with a TTL.
- Use the once-a-day Vercel cron for anything periodic [V8]. That cron also keeps Supabase from pausing.

If Celery must stay on Vercel, use the `vercel://` broker (Queues, beta) with `task_acks_late = True` and idempotent tasks. Queues does not defer `countdown`/`eta` [V6].

## Sources

- V1 Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- V2 Vercel plans / Hobby without a payment method (search summary of vercel.com docs): https://vercel.com/docs/plans
- V3 Deploy a Django app on Vercel (WebSockets / Django Channels section): https://vercel.com/docs/frameworks/full-stack/django
- V4 WebSocket support for Python Functions (changelog): https://vercel.com/changelog/websocket-support-is-now-available-for-python-functions
- V5 Vercel WebSockets docs: https://vercel.com/docs/functions/websockets
- V6 Run Celery on Vercel: https://vercel.com/docs/frameworks/backend/celery
- V7 Vercel Queues pricing: https://vercel.com/docs/queues/pricing
- V8 Vercel Cron Jobs usage and pricing: https://vercel.com/docs/cron-jobs/usage-and-pricing
- V9 Vercel Functions limits: https://vercel.com/docs/functions/limitations
- V10 Fluid compute pricing: https://vercel.com/docs/functions/usage-and-pricing
- S1 Supabase pricing: https://supabase.com/pricing
- S2 Supabase billing FAQ / beginners page (no card for free): https://supabase.com/docs/guides/platform/billing-faq
- S3 Supabase, Connecting to Postgres: https://supabase.com/docs/guides/database/connecting-to-postgres
- S4 Supabase, paused project restore window: https://supabase.com/docs/guides/platform/upgrading
- S5 Supabase Storage S3 authentication: https://supabase.com/docs/guides/storage/s3/authentication
- S6 Supabase Storage file limits: https://supabase.com/docs/guides/storage/uploads/file-limits
- S7 Supabase Realtime: https://supabase.com/docs/guides/realtime
- D1 Django PostgreSQL notes: https://docs.djangoproject.com/en/dev/ref/databases/
- R1 Redis Cloud Essentials plan details: https://redis.io/docs/latest/operate/rc/subscriptions/view-essentials-subscription/essentials-plan-details/
- R2 Redis Cloud free database: https://redis.io/docs/latest/operate/rc/databases/create-database/create-free-database/
- U1 Upstash Redis pricing: https://upstash.com/docs/redis/overall/pricing
- U2 Upstash, Celery integration: https://upstash.com/docs/redis/integrations/celery
- C1 channels_redis README and `core.py`: https://github.com/django/channels_redis
- RD1 Render, Deploy for Free: https://render.com/docs/free
- RD2 Render community / feedback on card verification: https://feedback.render.com/features/p/credit-card-required-for-free-plan
- K1 Koyeb instances: https://www.koyeb.com/docs/reference/instances
- K2 Koyeb scale-to-zero: https://www.koyeb.com/docs/run-and-scale/scale-to-zero
- K3 Koyeb pricing FAQ: https://www.koyeb.com/docs/faqs/pricing
- RW1 Railway plans: https://docs.railway.com/reference/pricing/plans
- RW2 Railway free trial: https://docs.railway.com/reference/pricing/free-trial
- RW3 Railway pricing FAQs: https://docs.railway.com/pricing/faqs
- F1 Fly.io pricing: https://docs.fly.io/about/pricing
- F2 Fly.io billing: https://fly.io/docs/about/billing/
- H1 Heroku pricing: https://www.heroku.com/pricing/
- H2 Heroku account verification: https://devcenter.heroku.com/articles/account-verification
- P1 PythonAnywhere pricing: https://www.pythonanywhere.com/pricing/
- P2 PythonAnywhere ASGI: https://help.pythonanywhere.com/pages/ASGICommandLine/
