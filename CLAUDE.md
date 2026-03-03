# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TGS3 — S3-compatible object storage backed by Telegram private channels. Files are chunked and stored as messages in Telegram private channels, accessed via standard AWS S3 API.

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- **Backend** (`@tgs3/api`): NestJS 11, Prisma 6 (SQLite), GramJS (Telegram MTProto)
- **Frontend** (`@tgs3/web`): Next.js 15 App Router, React 19, shadcn/ui, Tailwind CSS v4
- **Shared** (`@tgs3/shared`): Pure TypeScript types and constants

## Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start all services (web :3000, admin API :3001, S3 API :4000)
pnpm build            # Build all packages via Turborepo
pnpm lint             # Lint all packages
pnpm db:push          # Push Prisma schema to SQLite (no migration)
pnpm db:migrate       # Create and apply Prisma migration
pnpm db:generate      # Regenerate Prisma client
```

No test runner is configured.

## Architecture

### Dual NestJS Servers

The API app bootstraps **two separate NestJS applications** in `apps/api/src/main.ts`:

1. **Admin API** (port 3001) — JSON REST API with JWT auth, global `/api` prefix. Uses `AppModule` which imports all feature modules (Admin, Telegram, Keys, Buckets, Objects).

2. **S3 API** (port 4000) — S3-compatible binary/XML API with AWS SigV4 auth. Uses `S3AppModule` which is **completely separate** from AppModule. It provides services directly as providers (not via module imports) to avoid leaking admin controllers into the S3 server.

The S3 server disables NestJS body parsing and uses `express.raw()` with a 2GB limit, plus custom AWS chunked transfer encoding decoding middleware.

### Module Design

- `AdminModule` is `@Global()` — exports `JwtModule` available everywhere in the admin app
- `TelegramModule` is `@Global()` — singleton Telegram client in the admin app
- `S3AppModule` lists services directly in `providers` array (TelegramService, KeysService, etc.) rather than importing their modules, preventing admin controllers from being registered on the S3 server

### Authentication

- **Admin API**: JWT tokens (24h), validated by `AdminAuthGuard`
- **S3 API**: AWS SigV4 HMAC-SHA256 signatures, validated by `S3AuthGuard` (`common/guards/s3-auth.guard.ts`). Supports header-based auth and presigned URLs.

### File Storage Flow

Files are split into chunks → each chunk uploaded to a Telegram private channel as a message → `ObjectChunk` records map `chunkIndex` to Telegram `messageId`. Download reverses the process: retrieve chunks by messageId in order and stream them back.

Each bucket corresponds to one Telegram private channel.

### Frontend Proxy

Next.js rewrites `/api/*` to `http://localhost:3001/api/*` in `next.config.ts`, so the frontend talks to the admin API through its own dev server.

## Environment

`.env` must exist at **both** the repo root and `apps/api/.env` (Prisma reads `DATABASE_URL` before NestJS ConfigModule loads). See `.env.example` for required variables.

## Known Gotchas

- **Stale tsbuildinfo**: The API dev script removes `tsconfig.tsbuildinfo` before building to prevent tsc from skipping emission. `nest-cli.json` has `deleteOutDir: false` to avoid race conditions.
- **NestJS 11 route wildcards**: Use named params `*key`, not `:key(*)`.
- **GramJS imports**: `CustomFile` from `telegram/client/uploads`, `computeCheck` from `telegram/Password`. `downloadMedia` does not accept a `workers` option.
- **next.config.ts**: `outputFileTracingRoot` is set to the monorepo root for correct workspace detection in standalone builds.
