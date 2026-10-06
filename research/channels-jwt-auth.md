# Authenticating Django Channels WebSockets with simplejwt

Research for issue #8 (child of map #1). Stack: Django 6.x, Channels 4.x, djangorestframework-simplejwt 5.x, React SPA (Vite, HashRouter) possibly on a different origin than the API. Socket features: live order feed, customer-employee chat, employee online presence.

## TL;DR

- Browsers cannot set an `Authorization` header on a WebSocket, so the JWT has to travel some other way: query string, first message, cookie, or the `Sec-WebSocket-Protocol` header ([MDN WebSocket()](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket)).
- **Recommendation:** **send the access token as the first message** after connect, validated by simplejwt in the consumer (or a small shared base consumer). Wrap the router in `AllowedHostsOriginValidator`. Close the socket when the token expires and have the client reconnect with a fresh token. This is the approach OWASP recommends for browser token clients, works cross-origin, and keeps tokens out of URLs and logs.
- **Acceptable alternative:** a short-lived, single-use **ticket** in the query string. Use it if you need auth to happen during the handshake.
- **Don't** put the long-lived JWT in the query string. Use cookies only if API and SPA end up same-site.
- **Write a ~20-line custom version rather than adding a package.** simplejwt's own `JWTAuthentication` already does the work.

## Constraints from the primary sources

| Fact | Source |
|---|---|
| The `WebSocket(url, protocols)` constructor takes only a URL and subprotocols, so there is no way to set custom headers. | [MDN: WebSocket()](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket) |
| The handshake is **not** subject to CORS. Its credentials mode is `include`, so cookies are sent. | [WHATWG WebSockets spec](https://websockets.spec.whatwg.org/) |
| If the client offers subprotocols and the server does not echo one back, the browser fails the connection. | [WHATWG WebSockets spec](https://websockets.spec.whatwg.org/) |
| `AuthMiddlewareStack` = Cookie + Session + Auth middleware (session auth only). Other schemes need custom middleware that sets `scope["user"]`. Long-running consumers should re-check the user periodically. | [Channels: Authentication](https://channels.readthedocs.io/en/latest/topics/authentication.html) |
| `AllowedHostsOriginValidator` checks the `Origin` header against `ALLOWED_HOSTS`. In DEBUG with empty `ALLOWED_HOSTS` it allows localhost. A **missing** Origin is rejected unless `"*"` is allowed. | [Channels: Security](https://channels.readthedocs.io/en/latest/topics/security.html), [source](https://github.com/django/channels/blob/main/channels/security/websocket.py) |
| simplejwt `ACCESS_TOKEN_LIFETIME` defaults to 5 minutes. simplejwt does not support cookies natively. | [simplejwt settings](https://django-rest-framework-simplejwt.readthedocs.io/en/latest/settings.html) |
| `JWTAuthentication.get_validated_token(raw)` raises `InvalidToken`. `get_user(validated)` raises `InvalidToken`/`AuthenticationFailed`. These are reusable outside DRF views. | [simplejwt authentication.py](https://github.com/jazzband/djangorestframework-simplejwt/blob/master/rest_framework_simplejwt/authentication.py) |
| OWASP: "Avoid tokens in URL query strings because they can leak into access logs", "prefer sending the token in the first message over WSS", validate `Origin` against an explicit allowlist, re-validate long-lived sessions periodically, and authorize every message. | [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) |
| `SameSite=None` requires `Secure`. `Lax`/`Strict` cookies are not sent on cross-site subresource requests. | [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) |

## Options compared

### 1. Token as the first message (recommended)
The client connects, then sends `{"type":"auth","token":"<access>"}`. The server `accept()`s, waits for that message with a timeout (about 5 s), validates it with simplejwt, and then either sets `self.scope["user"]` or closes with code 4001. Until it is authenticated, the consumer joins no groups and sends nothing.
- **Pros:** The token never appears in a URL, so it stays out of proxy/access logs and history (OWASP's preferred option). It works cross-origin because no cookies are involved. It reuses the in-memory access token the SPA already uses for REST.
- **Cons:** Auth happens after the handshake, so a short window exists where unauthenticated sockets are open. Mitigate this with the timeout and by sending nothing before auth. The logic lives in a consumer (base class) rather than ASGI middleware.

### 2. Short-lived ticket in the query string
`POST /api/ws-ticket/` (JWT-authenticated) returns a random, single-use ticket that expires in about 30 s, stored in cache. The client connects to `wss://api/ws/orders/?ticket=...`. Middleware consumes the ticket (`cache.delete`) and sets `scope["user"]`.
- **Pros:** Authentication happens in the handshake, so `scope["user"]` is ready in `connect()`. A logged ticket is useless once used.
- **Cons:** An extra endpoint plus a shared cache. Because Channels needs a channel layer anyway, the Redis already used for that can serve, but `LocMemCache` breaks with more than one process. One extra round trip per connect.

### 3. JWT in the query string (`?token=<access>`)
This is the most common pattern in tutorials and in packages such as [channels-auth-token-middlewares](https://github.com/YegorDB/django-channels-auth-token-middlewares).
- **Pros:** Trivial to implement, and auth happens in the handshake.
- **Cons:** The bearer token ends up in Daphne/Uvicorn/nginx access logs and any APM, which OWASP explicitly advises against. A 5-minute lifetime limits the damage but does not remove it. Never use the refresh token this way.

### 4. httpOnly cookie
Set the access token, or a Django session, in an httpOnly cookie. The browser sends it on the handshake automatically ([WHATWG](https://websockets.spec.whatwg.org/)), and `AuthMiddlewareStack` (for sessions) or a cookie-reading JWT middleware picks it up.
- **Pros:** JavaScript cannot read the token, which protects it from XSS.
- **Cons:**
  - **Cross-site SPA:** this needs `SameSite=None; Secure` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)), and third-party-cookie blocking in Safari, Firefox and others can drop it. Note that "same-site" means the same registrable domain, so `app.example.com` and `api.example.com` are still same-site.
  - **CORS:** CORS does not apply to WebSockets, so `django-cors-headers` does nothing for the socket. CSRF-style Cross-Site WebSocket Hijacking is then only stopped by the Origin check. `AllowedHostsOriginValidator` becomes **mandatory**, and because it compares Origin to `ALLOWED_HOSTS`, a SPA on another host must be listed there, or you use `OriginValidator(app, [...spa origins])` instead.
  - **REST changes:** the REST side must also move to cookies plus CSRF, because simplejwt doesn't support cookies natively. That is a large change for this project.
- Worth it only if the SPA and API are deployed same-site.

### 5. `Sec-WebSocket-Protocol` trick
`new WebSocket(url, ["access_token", token])`. The server reads the token from `scope["subprotocols"]` and **must** `accept(subprotocol="access_token")`, or the browser fails the connection ([WHATWG](https://websockets.spec.whatwg.org/)).
- **Pros:** Auth happens in the handshake, and many proxies don't log this header by default.
- **Cons:** It misuses a header meant for protocol negotiation. The token must contain only valid token characters (JWT base64url plus `.` is fine). It is easy to get subtly wrong, and some proxies or APMs do log headers. It offers no real advantage over option 1 or 2.

### Ranking for this project
1. First-message auth
2. Ticket
3. Cookie (only if same-site)
4. Subprotocol
5. Raw JWT in the query string

## Token expiry on long-lived sockets
- Validation only happens once, at connect or auth time. After that the socket stays open even after the 5-minute access token expires. To bound this, store `exp` from the validated token and, in the consumer, schedule `self.close(code=4001)` at `exp`, or check it on each `receive`. The client already refreshes its access token for REST via `/api/token/refresh/`, so on close 4001 it refreshes and reconnects. Alternatively the client can send a new `{"type":"auth"}` message before `exp`, and the server re-validates and moves the deadline.
- If the user is deactivated or logs out, push a close through the user's group (e.g. `user_<id>`) so the change takes effect immediately rather than at `exp`. This follows the Channels docs' advice to re-check the user periodically ([Channels auth](https://channels.readthedocs.io/en/latest/topics/authentication.html)) and OWASP's advice to re-validate long-lived sessions.
- Authorize every action, not just the connect (OWASP). Examples: a customer may only join `chat_<id>` for their own conversation, and only employees may join `orders`.
- Presence: tie online/offline to `connect`/`disconnect` after auth succeeds. Expiry-driven reconnects will cause brief offline flaps, so debounce them (e.g. mark offline after a few seconds without a reconnect).

## Package vs custom middleware
- [channels-auth-token-middlewares](https://github.com/YegorDB/django-channels-auth-token-middlewares) requires Channels >= 4.1 and provides a SimpleJWT middleware that reads the token from a header, cookie or query string. It is small, maintained by one person, and has around 27 stars. It does not cover first-message auth or tickets, which are the options recommended here.
- The custom version is about 20 lines and delegates all JWT logic (signature, `exp`, user lookup, `is_active`) to simplejwt itself:

```python
# server/<app>/ws_auth.py
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

_jwt = JWTAuthentication()

@database_sync_to_async
def user_from_token(raw: str):
    """Return (user, exp) or (AnonymousUser(), None)."""
    try:
        token = _jwt.get_validated_token(raw)
        return _jwt.get_user(token), token["exp"]
    except (InvalidToken, AuthenticationFailed):
        return AnonymousUser(), None
```

A base `AsyncJsonWebsocketConsumer` then: `accept()`, then waits for `{"type":"auth"}` with a timeout, calls `user_from_token`, and closes with 4001 on failure or at `exp`. Routing:

```python
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns)),
})
```

If the SPA is on a different host from the API, swap in `OriginValidator(..., ["https://<spa-origin>"])` (or add the host to `ALLOWED_HOSTS`). Either way, keep an explicit allowlist and never use `"*"`.

## Repo notes
- `server/config/settings.py` currently has `ALLOWED_HOSTS = []` and `corsheaders` installed. Neither `SIMPLE_JWT` nor Channels is configured yet, so the defaults above (5-minute access token) apply until changed.
- `django-cors-headers` settings do **not** cover WebSockets. The origin allowlist has to be configured separately in the ASGI router.
