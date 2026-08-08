# Service Worker & Browser Cache — StockFlow Web

**Status:** Reference documentation · Applies to: Flutter Web on Railway (`stockflow-web`)

Flutter Web ships a service worker (`flutter_service_worker.js`) that caches
the app shell and assets so the app loads offline / near-instantly on repeat
visits. This document explains how caching behaves, how updates propagate,
and how users (and support) resolve stale-UI issues.

## How the cache is structured

Flutter's default service worker maintains two caches:

| Cache | Contents | Policy |
|---|---|---|
| `flutter-app-cache` | `index.html`, `main.dart.js`, `flutter_bootstrap.js`, asset manifests, fonts | Cache-first while offline; revalidates via `version.json` |
| `flutter-app-manifest` | app manifest | Version-keyed |

The nginx layer (see `web-deploy/nginx.conf`) adds HTTP caching rules on top:

| Path | Cache-Control | Rationale |
|---|---|---|
| `/assets/*`, `/canvaskit/*`, static images/fonts | `public, immutable` (30d) | Content-hashed — never changes in place |
| `/main.dart.js`, `/flutter_bootstrap.js`, `/flutter.js`, `/flutter_service_worker.js`, `/manifest.json`, `/version.json`, `/index.html` | `no-cache` (revalidate) | Unhashed entrypoints must pick up new deploys |

## Update flow (how a new release reaches users)

1. CI builds `mobile/build/web` and deploys a new image to Railway.
2. Browser navigates to the site; `index.html` (no-cache) is revalidated and
   the new `flutter_bootstrap.js` is fetched.
3. `flutter_bootstrap.js` loads `version.json?cachebuster=<timestamp>`; the
   service worker compares it with the installed version.
4. On version change, the service worker fetches the new `main.dart.js` and
   app shell into `flutter-app-cache`, then the app boots the new version.

Because entrypoints are `no-cache`, **a new deploy is normally picked up on
the next page load without any user action.**

## Why a user may still see a stale app

The most common real-world causes (all resolve with a hard refresh):

1. **Service worker holding the previous app shell.** A long-lived tab that
   never reloads keeps the old SW alive until the browser updates it in the
   background. The new version is applied after the tab is closed/reopened or
   on a manual refresh.
2. **Browser HTTP cache of entrypoints** if the user first visited during a
   broken-deploy window (e.g. the earlier `COPY html/` failures) before the
   `no-cache` headers existed — their browser may have cached an old
   `index.html`/`main.dart.js` locally.
3. **Local proxies / VPN caching** re-serving an old snapshot of the site.

## Hard refresh (fastest fix)

| Browser | Shortcut |
|---|---|
| Chrome / Edge (macOS) | `Cmd + Shift + R` |
| Chrome / Edge (Windows/Linux) | `Ctrl + Shift + R` |
| Firefox (macOS) | `Cmd + Shift + R` |
| Firefox (Windows/Linux) | `Ctrl + F5` |
| Safari (macOS) | `Cmd + Option + R` |

## Clear site data (full reset)

If a hard refresh is not enough (e.g. old service worker persists):

**Chrome / Edge:**
1. DevTools (`F12`) → **Application** tab.
2. **Service Workers** (left) → **Unregister** → **Update**.
3. **Storage** → **Clear site data**.
4. Reload.

**Safari:** Safari → Settings → Privacy → Manage Website Data → search for
the domain → **Remove**.

**Firefox:** Settings → Privacy & Security → Cookies and Site Data → Manage
Data → search → **Remove**.

Or simply use a private/incognito window — it starts with an empty cache.

## Version bump as a deployment lever

If stale-cache reports persist after a release, the `version.json` content
changes on every build (Flutter embeds a build timestamp), which triggers the
service-worker update path. No manual cache-busting is required for normal
releases.

For an emergency forced refresh of all users (e.g. after a broken deploy),
you can temporarily change `version.json`'s value via the deployment itself —
redeploying the current build already produces a new cachebuster.

## Operational guidance for support

| Symptom | Action |
|---|---|
| User sees an old UI after a release | Hard refresh; if it persists, clear site data (steps above) |
| Login fails but API health is 200 | Usually a stale SW/browser cache of the pre-fix build — hard refresh or private window |
| User on a different domain | Confirm they use the canonical URL (see `docs/domain-migration.md`) |
| Offline-first not needed | Caching is fine to keep; entrypoints revalidate so the app stays current |

## Verification commands

```bash
# 1. Entrypoints are revalidated (no immutable caching)
curl -sI https://stockflow-web-production-9f0b.up.railway.app/main.dart.js \
  | grep -i 'cache-control'
# expect: Cache-Control: no-cache

# 2. Hashed assets are immutable
curl -sI https://stockflow-web-production-9f0b.up.railway.app/assets/AssetManifest.bin \
  | grep -i 'cache-control'
# expect: public, immutable

# 3. Service worker is served fresh
curl -s https://stockflow-web-production-9f0b.up.railway.app/flutter_service_worker.js \
  | head -5
```
