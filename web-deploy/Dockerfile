# ═══════════════════════════════════════════════════════════════
# StockFlow Web — Static hosting image (nginx)
# ═══════════════════════════════════════════════════════════════
# Serves the Flutter web build (mobile/build/web) copied into html/.
# The GitHub Actions workflow (web-deploy.yml) stages the assets here
# before `railway up` builds this image.

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/

EXPOSE 80
