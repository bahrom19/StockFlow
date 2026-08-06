# ═══════════════════════════════════════════════════════════════
# StockFlow Web — Static hosting image (nginx)
# ═══════════════════════════════════════════════════════════════
# Serves the Flutter web build (mobile/build/web) copied into html/.
# The GitHub Actions workflow (web-deploy.yml) stages the assets here
# before `railway up` builds this image.
#
# nginx.conf is copied into /etc/nginx/templates/ so the official
# nginx:alpine entrypoint runs envsubst on it at startup: `${PORT}`
# is replaced with Railway's dynamically injected PORT, which is also
# the port its healthcheck probes. A hardcoded `listen 80` would make
# every Railway deploy fail its healthcheck.

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY html/ /usr/share/nginx/html/

EXPOSE 80
