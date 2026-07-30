# --- Base ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /workspace

# --- Dependencies (installs full workspace so pnpm can link @ai-career/shared) ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile --filter=@ai-career/api... --filter=@ai-career/shared

# --- Build ---
FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /workspace/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter=@ai-career/shared run build
RUN pnpm --filter=@ai-career/api exec prisma generate
RUN pnpm --filter=@ai-career/api run build

# --- Runtime ---
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/prisma ./apps/api/prisma

RUN pnpm install --frozen-lockfile --prod --filter=@ai-career/api...
RUN pnpm add -D prisma@5.20.0 --filter=@ai-career/api
RUN pnpm --filter=@ai-career/api exec prisma generate

WORKDIR /workspace/apps/api
EXPOSE 4000

COPY apps/api/docker-entrypoint.sh /workspace/apps/api/docker-entrypoint.sh
RUN chmod +x /workspace/apps/api/docker-entrypoint.sh

ENTRYPOINT ["/workspace/apps/api/docker-entrypoint.sh"]
