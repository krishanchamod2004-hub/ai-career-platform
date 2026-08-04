# =============================================================================
# Next.js 14 Production Dockerfile - Monorepo + Standalone
# =============================================================================
# This Dockerfile properly handles Next.js standalone output in a pnpm monorepo.
# The key issue: Next.js standalone may not properly trace all dependencies in
# a monorepo setup, so we need to manually ensure all runtime deps are included.
#
# Build: docker build -f apps/web/Dockerfile -t your-registry/ai-career-web:latest .
# Push:  docker push your-registry/ai-career-web:latest
# Run:   docker run -p 3000:3000 your-registry/ai-career-web:latest
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base - Install pnpm and setup workspace
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install essential system dependencies
RUN apk add --no-cache libc6-compat

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /build

# Configure pnpm to avoid symlink issues
RUN pnpm config set node-linker hoisted

# -----------------------------------------------------------------------------
# Stage 2: Dependencies - Install all workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy workspace configuration files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy all package.json files for dependency resolution
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json

# Copy shared package source (needed for prepare script during install)
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json

# Install ALL dependencies (including devDependencies needed for build)
# Using frozen-lockfile ensures reproducible builds
RUN --mount=type=cache,id=pnpm-store-web,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Builder - Build shared package and Next.js application
# -----------------------------------------------------------------------------
FROM base AS builder

# Copy installed dependencies from deps stage
COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/apps/web/node_modules ./apps/web/node_modules

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy shared package source and build it first
COPY packages/shared ./packages/shared
RUN pnpm --filter=@ai-career/shared run build

# Copy web app source
COPY apps/web ./apps/web

# Set build-time environment variables (these get baked into the build)
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js with standalone output
WORKDIR /build/apps/web
RUN pnpm run build

# Verify standalone output was created
RUN ls -la .next/standalone/ && echo "Standalone build complete"

# -----------------------------------------------------------------------------
# Stage 4: Production Dependencies
# -----------------------------------------------------------------------------
FROM base AS prod-deps

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy package.json files
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json

# Copy shared package source (needed for prepare script)
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json

# Install ONLY production dependencies with --ignore-scripts to avoid prepare hook issues
RUN --mount=type=cache,id=pnpm-store-web-prod,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy the already-built shared package from builder stage
# (We can't build it here because TypeScript is a devDependency)
COPY --from=builder /build/packages/shared/dist ./packages/shared/dist

# -----------------------------------------------------------------------------
# Stage 5: Runner - Minimal production runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install minimal runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# CRITICAL FIX FOR MONOREPO:
# Next.js standalone output may not include all dependencies from a monorepo.
# We need to copy both the standalone output AND production node_modules.

# 1. Copy the standalone output (includes server.js and partial dependencies)
COPY --from=builder --chown=nestjs:nodejs /build/apps/web/.next/standalone ./

# 2. Copy production node_modules to ensure ALL runtime deps are available
# This includes the shared package and all its dependencies
COPY --from=prod-deps --chown=nextjs:nodejs /build/node_modules ./node_modules

# 3. Copy the built shared package
COPY --from=prod-deps --chown=nextjs:nodejs /build/packages/shared/dist ./packages/shared/dist
COPY --from=prod-deps --chown=nextjs:nodejs /build/packages/shared/package.json ./packages/shared/package.json

# 4. Copy static files into the correct location within standalone structure
# Next.js expects these at apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /build/apps/web/.next/static ./apps/web/.next/static

# 5. Copy public folder into the correct location
# Next.js expects these at apps/web/public
COPY --from=builder --chown=nextjs:nodejs /build/apps/web/public ./apps/web/public

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Health check endpoint - verify the app responds
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Use dumb-init to properly handle signals (graceful shutdown)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the Next.js server
# server.js is at the ROOT of /app in standalone output
CMD ["node", "server.js"]
