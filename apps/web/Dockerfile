# =============================================================================
# Next.js 14 Production Dockerfile - Manual node_modules (Working)
# =============================================================================
# Standalone dependency tracing is broken in monorepos, so we manually copy
# production node_modules instead of relying on Next.js's automatic tracing.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat dumb-init curl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /build

# -----------------------------------------------------------------------------
# Install ALL dependencies (dev + prod)
# -----------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json

# Copy shared package source (needed for prepare script)
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Install production-only dependencies separately
# -----------------------------------------------------------------------------
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json

# Copy shared package source
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json

# Install prod dependencies (skip prepare script to avoid build errors)
RUN --mount=type=cache,id=pnpm-prod,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy the already-built shared package from deps stage
COPY --from=deps /build/packages/shared/dist ./packages/shared/dist

# -----------------------------------------------------------------------------
# Build application
# -----------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/apps/web/node_modules ./apps/web/node_modules

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
RUN pnpm --filter=@ai-career/shared run build

COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /build/apps/web
RUN pnpm run build

# Debug
RUN echo "=== Checking build output ===" && \
    ls -la .next/standalone/ && \
    ls -la .next/static/

# -----------------------------------------------------------------------------
# Production runtime - Manual assembly
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init curl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone server (includes server.js)
COPY --from=builder --chown=nextjs:nodejs /build/apps/web/.next/standalone ./

# CRITICAL: Manually copy production node_modules
# Standalone tracing is broken in monorepos, so we do it ourselves
COPY --from=prod-deps --chown=nextjs:nodejs /build/node_modules ./node_modules
COPY --from=prod-deps --chown=nextjs:nodejs /build/packages/shared ./packages/shared

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /build/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /build/apps/web/public ./public

# Verify everything is in place
RUN echo "=== Final verification ===" && \
    echo "1. Server file:" && ls -la /app/server.js && \
    echo "2. node_modules:" && ls -la /app/node_modules | head -10 && \
    echo "3. next module:" && ls -la /app/node_modules/next && \
    echo "4. shared package:" && ls -la /app/packages/shared/dist && \
    echo "5. Static files:" && ls -la /app/.next/static | head -5 && \
    echo "6. Public files:" && ls -la /app/public | head -5 && \
    echo "=== All checks passed ==="

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
