# =============================================================================
# Multi-stage Dockerfile for NestJS API
# Optimized for production: multi-stage builds, layer caching, minimal runtime
# =============================================================================

# --- Base Stage ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /workspace

# --- Dependencies Stage (installs full workspace so pnpm can link @ai-career/shared) ---
FROM base AS deps
# Copy pnpm-lock.yaml first for better layer caching
COPY pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile --filter=@ai-career/api... --filter=@ai-career/shared

# --- Build Stage ---
FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /workspace/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package first
RUN pnpm --filter=@ai-career/shared run build

# Generate Prisma Client
RUN pnpm --filter=@ai-career/api exec prisma generate

# Build API
RUN pnpm --filter=@ai-career/api run build

# --- Production Dependencies Stage ---
FROM base AS prod-deps
COPY pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod --filter=@ai-career/api...
# Prisma CLI needed for migrations at runtime
RUN pnpm add -D prisma@5.20.0 --filter=@ai-career/api

# --- Runtime Stage ---
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /workspace
ENV NODE_ENV=production

# Copy workspace configuration
COPY --from=build --chown=nodejs:nodejs /workspace/package.json /workspace/pnpm-workspace.yaml ./

# Copy shared package
COPY --from=build --chown=nodejs:nodejs /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=nodejs:nodejs /workspace/packages/shared/dist ./packages/shared/dist

# Copy API package
COPY --from=build --chown=nodejs:nodejs /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=nodejs:nodejs /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nodejs:nodejs /workspace/apps/api/prisma ./apps/api/prisma

# Copy production dependencies
COPY --from=prod-deps --chown=nodejs:nodejs /workspace/node_modules ./node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /workspace/apps/api/node_modules ./apps/api/node_modules

# Generate Prisma Client in production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN pnpm --filter=@ai-career/api exec prisma generate

WORKDIR /workspace/apps/api

# Copy entrypoint script
COPY --chown=nodejs:nodejs apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Switch to non-root user
USER nodejs

EXPOSE 4000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
