# =============================================================================
# NestJS API Production Dockerfile - Build Locally, Deploy Anywhere
# =============================================================================
# This Dockerfile builds both API and Worker from the same image.
# The image is self-contained and can run on any Linux x64 system.
#
# Build: docker build -f apps/api/Dockerfile -t your-registry/ai-career-api:latest .
# Push:  docker push your-registry/ai-career-api:latest
# Run API: docker run -p 4000:4000 your-registry/ai-career-api:latest
# Run Worker: docker run your-registry/ai-career-api:latest node dist/worker.js
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base - Install pnpm and setup workspace
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install system dependencies (openssl for Prisma)
RUN apk add --no-cache libc6-compat openssl

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /build

# Configure pnpm
RUN pnpm config set node-linker hoisted

# -----------------------------------------------------------------------------
# Stage 2: Dependencies - Install all workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy package.json files
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# Copy shared package source (needed for prepare script during install)
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json

# Install ALL dependencies (including devDependencies for build)
RUN --mount=type=cache,id=pnpm-store-v2,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Builder - Build shared package and NestJS application
# -----------------------------------------------------------------------------
FROM base AS builder

# Copy installed dependencies
COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /build/apps/api/node_modules ./apps/api/node_modules

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy and build shared package
COPY packages/shared ./packages/shared
RUN pnpm --filter=@ai-career/shared run build

# Copy API source
COPY apps/api ./apps/api

WORKDIR /build/apps/api

# Generate Prisma Client
RUN pnpm exec prisma generate

# Build NestJS application (creates dist/ folder)
RUN pnpm run build

# Compile the seed script to JavaScript (so it can run without ts-node in production)
# Use explicit compiler options to ensure it works with Prisma Client and bcryptjs imports
RUN pnpm exec tsc prisma/seed.ts \
    --outDir dist \
    --module commonjs \
    --moduleResolution node \
    --esModuleInterop \
    --allowSyntheticDefaultImports \
    --resolveJsonModule \
    --skipLibCheck \
    --target es2020 \
    --lib es2020

# -----------------------------------------------------------------------------
# Stage 4: Production Dependencies - Install only production dependencies
# -----------------------------------------------------------------------------
FROM base AS prod-deps

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy package.json files
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# Copy shared package source (needed for prepare script during install)
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json

# Copy Prisma schema (needed for client generation)
COPY apps/api/prisma ./apps/api/prisma

# Install ONLY production dependencies
RUN --mount=type=cache,id=pnpm-store-v2,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Generate Prisma Client in production node_modules
WORKDIR /build/apps/api
RUN pnpm exec prisma generate

# -----------------------------------------------------------------------------
# Stage 5: Runner - Minimal production runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install minimal runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    openssl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy production dependencies (includes Prisma Client)
COPY --from=prod-deps --chown=nestjs:nodejs /build/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /build/apps/api/node_modules ./apps/api/node_modules

# Copy workspace configuration
COPY --chown=nestjs:nodejs pnpm-workspace.yaml package.json ./

# Copy built shared package
COPY --from=builder --chown=nestjs:nodejs /build/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nestjs:nodejs /build/packages/shared/package.json ./packages/shared/package.json

# Copy built API application
COPY --from=builder --chown=nestjs:nodejs /build/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /build/apps/api/package.json ./apps/api/package.json

# Copy Prisma files (needed for migrations at runtime)
COPY --from=builder --chown=nestjs:nodejs /build/apps/api/prisma ./apps/api/prisma

# Copy entrypoint script if exists
COPY --chown=nestjs:nodejs apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh || true

# Create uploads directory with correct permissions
RUN mkdir -p /app/apps/api/uploads && \
    chown -R nestjs:nodejs /app/apps/api/uploads

# Switch to non-root user
USER nestjs

WORKDIR /app/apps/api

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default command starts the API server
# For worker, override with: docker run image node dist/worker.js
CMD ["./docker-entrypoint.sh"]
