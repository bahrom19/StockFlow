# ═══════════════════════════════════════════════════════════════
# StockFlow Enterprise — Production Docker Image
# ═══════════════════════════════════════════════════════════════
# Multi-stage build with security hardening:
#   - Non-root user
#   - Distroless-inspired runner
#   - No build tools in production
#   - Read-only root filesystem compatible
#   - Health check
#   - Trivy-scan ready
#
# Build: docker build -t stockflow-backend .
# Run:   docker run -p 3000:3000 stockflow-backend
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Base ──────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini
ENV NODE_ENV=production

# ── Stage 2: Dependencies ──────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Stage 3: Build ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ── Stage 4: Production Runner ─────────────────────────────────
FROM alpine:3.21 AS runner

# Install only what's needed at runtime
RUN apk add --no-cache \
    nodejs=~22 \
    tini \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production artifacts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Security hardening
RUN chown -R appuser:appgroup /app && \
    chmod -R 755 /app && \
    chmod 700 /app/prisma

USER appuser

# Security headers (helmet handles these at app level)

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/live || exit 1

# Use tini as PID 1 to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
