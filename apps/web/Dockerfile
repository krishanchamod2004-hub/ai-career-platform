# =============================================================================
# Multi-stage Dockerfile for Next.js Web App
# Optimized for production: multi-stage builds, layer caching, minimal runtime
# =============================================================================

# --- Base Stage ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /workspace

# --- Dependencies Stage ---
FROM base AS deps
# Copy pnpm-lock.yaml first for better layer caching
COPY pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --filter=@ai-career/web... --filter=@ai-career/shared

# --- Build Stage ---
FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /workspace/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build arguments - MUST be set at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Build shared package first
RUN pnpm --filter=@ai-career/shared run build

# Build Next.js app
RUN pnpm --filter=@ai-career/web run build

# --- Runtime Stage (Next.js standalone output) ---
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output
COPY --from=build --chown=nodejs:nodejs /workspace/apps/web/public ./public
COPY --from=build --chown=nodejs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=nodejs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static

# Switch to non-root user
USER nodejs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
