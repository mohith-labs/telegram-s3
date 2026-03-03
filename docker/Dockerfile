FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.7.1 --activate
RUN apk add --no-cache libc6-compat python3 make g++

# Pruner stage
FROM base AS pruner
RUN npm install -g turbo@^2.4.0
WORKDIR /app
COPY . .
RUN turbo prune @tgs3/api @tgs3/web --docker

# Installer stage
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --no-frozen-lockfile

# Builder stage
FROM base AS builder
RUN npm install -g turbo@^2.4.0
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN cd apps/api && npx prisma generate
RUN turbo build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 tgs3 && \
    adduser --system --uid 1001 tgs3

# Copy built API
COPY --from=builder --chown=tgs3:tgs3 /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=tgs3:tgs3 /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=tgs3:tgs3 /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=tgs3:tgs3 /app/node_modules ./node_modules

# Copy built Web (Next.js standalone)
COPY --from=builder --chown=tgs3:tgs3 /app/apps/web/.next/standalone ./
COPY --from=builder --chown=tgs3:tgs3 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=tgs3:tgs3 /app/apps/web/public ./apps/web/public

# Copy start script
COPY --chown=tgs3:tgs3 docker/start.sh ./start.sh
RUN chmod +x ./start.sh

# Data directory for SQLite
RUN mkdir -p /data && chown tgs3:tgs3 /data
VOLUME /data

USER tgs3
ENV DATABASE_URL="file:/data/tgs3.db"
ENV NODE_ENV=production

EXPOSE 3000 3001 4000
CMD ["./start.sh"]
