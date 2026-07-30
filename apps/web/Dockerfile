# --- Base ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /workspace

# --- Dependencies ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --filter=@ai-career/web... --filter=@ai-career/shared

# --- Build ---
FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /workspace/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN pnpm --filter=@ai-career/shared run build
RUN pnpm --filter=@ai-career/web run build

# --- Runtime (Next.js standalone output) ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /workspace/apps/web/public ./public
COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
