# ═══════════════════════════════════════════════════════════════
# StockFlow Enterprise — Production Docker Image (Railway-optimised)
# ═══════════════════════════════════════════════════════════════
# Multi-stage build:
#   base        — shared Node.js base
#   deps        — production dependencies only
#   build       — full dev dependencies + compile + Prisma generate
#   runner      — minimal production image (node:22-alpine)
#
# Build: docker build -t stockflow-backend .
# Run:   docker run -p 3000:3000 -e DATABASE_URL=... stockflow-backend
#
# Railway:
#   Deploy Command (in Railway dashboard):
#     npx prisma generate && npx prisma migrate deploy
#   Start Command (in Railway dashboard — overrides CMD):
#     node dist/main.js
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Base ──────────────────────────────────────────────
FROM node:26-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini ca-certificates

# ── Stage 2: Production Dependencies ───────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 3: Build ─────────────────────────────────────────────
FROM node:26-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ── Stage 4: Production Runner ─────────────────────────────────
FROM node:26-alpine AS runner
WORKDIR /app

# Install only runtime system deps
RUN apk add --no-cache tini ca-certificates && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# ── Copy production artifacts ──────────────────────────────────
# Order matters: deps first, then generated Prisma client overwrites

# 1. Production node_modules (has @prisma/client + prisma CLI)
COPY --from=deps /app/node_modules ./node_modules

# 2. Prisma generated client (not present in deps — created by prisma generate)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# 3. Compiled application
COPY --from=build /app/dist ./dist

# 4. Prisma schema + migrations (needed for prisma migrate deploy at runtime)
COPY --from=build /app/prisma ./prisma

# 5. Package files (for postinstall if needed)
COPY --from=build /app/package*.json ./

# ── Security hardening ─────────────────────────────────────────
RUN chown -R appuser:appgroup /app && \
    chmod -R 755 /app && \
    chmod 700 /app/prisma/migrations

USER appuser

# ── Application port ───────────────────────────────────────────
# Railway overrides PORT env var automatically
ENV PORT=3000
EXPOSE 3000

# ── Health check ───────────────────────────────────────────────
# Shell form (non-JSON) so $PORT is expanded at runtime
# Railway sets PORT dynamically, so the healthcheck must follow
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT}/api/health/live" || exit 1

# ── Entrypoint / CMD ───────────────────────────────────────────
# Uses tini (PID 1) for proper signal handling
# NO npx — migrations run separately via Railway Deploy Command
# For local dev, override: docker run ... stockflow-backend sh -c "prisma migrate deploy && node dist/main.js"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
