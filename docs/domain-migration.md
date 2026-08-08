# Canonical Domain Migration — stockflow-web

**Status:** Prepared (not executed) · **Owner:** Platform / DevOps
**Applies to:** Railway static service `stockflow-web` (Flutter Web)

## Current state

| Item | Value |
|---|---|
| Active public URL | `https://stockflow-web-production-9f0b.up.railway.app` (Railway-generated, active) |
| Desired canonical URL | `https://stockflow-web.up.railway.app` |
| Backend API | `https://stockflow-production-04c7.up.railway.app/api` (unchanged) |
| Web artifact | `mobile/build/web` built in CI, staged to `web-deploy/html`, served by nginx |

The web app talks to the backend through `API_BASE_URL` from `mobile/env/.env.prod`,
which is embedded at build time — **domain migration needs zero code changes**.

## Why migrate

1. The generated domain contains a random suffix (`production-9f0b`) that is
   hard to communicate to customers.
2. A canonical, stable hostname is required before custom DNS (CNAME) or a
   branded subdomain can be attached.
3. Bookmarks and printed receipts should point to a URL that never changes.

## 1. Railway Networking steps

1. Open Railway dashboard → project (e.g. `stockflow`) → service **stockflow-web**.
2. Go to **Settings → Networking → Generate Domain** (or, if a domain already
   exists, use **Custom Domain**).
3. To obtain the canonical Railway domain:
   - Railway automatically assigns `https://<service>.up.railway.app` the first
     time a domain is generated. If the existing random one is the only one,
     delete it and generate a fresh domain — Railway will issue the clean
     `stockflow-web.up.railway.app` form when the service name matches.
   - Alternative (recommended for determinism): add a **Custom Domain**
     (see §3 below).
4. Click **Save / Add Domain**. Railway provisions the TLS certificate
   automatically (Let's Encrypt) and returns the public URL.

> Note: only one `*.up.railway.app` domain per service is allowed. If you want
> the canonical Railway domain, remove the old random one first.

## 2. TLS verification

Railway provisions and renews TLS automatically. Verify after migration:

```bash
# 1. Certificate is valid, issuer, and expiry
echo | openssl s_client -servername stockflow-web.up.railway.app \
  -connect stockflow-web.up.railway.app:443 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates

# 2. HTTPS serves the app
curl -s -o /dev/null -w 'index: %{http_code}\n' \
  https://stockflow-web.up.railway.app/

# 3. SPA fallback works on the canonical host
for p in pos reports payments; do
  echo -n "/$p: "
  curl -s -o /dev/null -w '%{http_code}\n' \
    https://stockflow-web.up.railway.app/$p
done

# 4. API is still reachable from the web origin (CORS)
curl -s -o /dev/null -w 'health: %{http_code}\n' \
  https://stockflow-production-04c7.up.railway.app/api/health
```

Expected: `index: 200`, all SPA paths `200`, certificate `issuer=Let's Encrypt`.

## 3. DNS configuration (custom domain, optional)

If using a custom domain (e.g. `app.stockflow.com`) instead of the Railway
subdomain:

| Record type | Name | Value | TTL |
|---|---|---|---|
| CNAME | `app` | `stockflow-web.up.railway.app.` | 300 (or provider minimum) |

1. Create the CNAME record in the DNS provider (Cloudflare / Route 53 / registrar).
2. In Railway → stockflow-web → Settings → Networking → **Custom Domain**,
   enter `app.stockflow.com` → Add.
3. Railway verifies the CNAME and issues a TLS certificate for the custom
   domain (a few minutes; wildcard-cert or per-host).
4. If the DNS provider offers proxy mode (Cloudflare orange cloud), keep it
   **DNS only** initially to avoid double-TLS, then enable proxy after
   verifying the origin certificate.

## 4. Rollback

Rollback is instant and requires **no code changes** because the web build is
hostname-agnostic (the backend URL is baked in at build time, not the web
hostname):

- **Rollback to the random domain:** Railway → stockflow-web → Settings →
  Networking → remove the canonical domain → the previous
  `stockflow-web-production-9f0b.up.railway.app` remains active.
- **Rollback to a previous deployment:** Railway → stockflow-web →
  **Deployments** → select the last known-good build → **Redeploy** (or the
  `railway rollback` CLI equivalent in the dashboard).
- **DNS rollback (custom domain):** delete the CNAME (or point it back),
  then remove the custom domain from Railway Networking.

### Migration checklist

- [ ] Canonical domain active & HTTPS 200
- [ ] SPA fallback paths 200
- [ ] Login / register work on the canonical URL
- [ ] Old random URL still resolves (grace period) or redirected
- [ ] Playwright E2E auth suite green against the canonical URL
- [ ] Backend `API_BASE_URL` untouched, CORS still `*`
- [ ] Receipts/bookmarks updated to the canonical URL
