# =============================================================================
# Next.js 14 Production Dockerfile - Build Locally, Deploy Anywhere
# =============================================================================
# This Dockerfile is designed to be built on your local machine and deployed
# to any VPS without rebuilding. It eliminates all pnpm symlink issues by
# bundling everything into a self-contained standalone output.
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
# Standalone output includes all necessary files in .next/standalone
WORKDIR /build/apps/web
RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 4: Runner - Minimal production runtime
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

# Copy the standalone output which includes everything needed to run
# The standalone output is self-contained with all dependencies bundled
COPY --from=builder --chown=nextjs:nodejs /build/apps/web/.next/standalone ./

# Copy static files (built assets)
COPY --from=builder --chown=nextjs:nodejs /build/apps/web/.next/static ./apps/web/.next/static

# Copy public folder (images, fonts, etc.)
COPY --from=builder --chown=nextjs:nodejs /build/apps/web/public ./apps/web/public

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init to properly handle signals (graceful shutdown)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the Next.js server
# The standalone output creates a server.js at apps/web/server.js
CMD ["node", "apps/web/server.js"]
