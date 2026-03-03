# TGS3

S3-compatible object storage backed by Telegram. Files are chunked and stored as messages in Telegram private channels, accessed via the standard AWS S3 API.

## How It Works

1. Each **bucket** maps to a Telegram private channel
2. Uploaded files are split into chunks and sent as messages to that channel
3. Downloads retrieve chunks by message ID in order and stream them back
4. All access goes through a standard **S3-compatible API** — use any S3 client (`aws-cli`, `s3cmd`, Boto3, etc.)

## Features

- **S3-compatible API** with AWS Signature V4 authentication
- **Multipart uploads** for large files (up to 2 GB per object)
- **Admin dashboard** for managing buckets, access keys, and Telegram connection
- **Access key permissions** with per-bucket granularity
- **Presigned URL** support
- **SQLite** database — zero external dependencies

## Architecture

```
┌──────────────┐     ┌───────────────────────────────────────┐
│   S3 Client  │────▶│  S3 API  (:4000)                      │
│  (aws-cli…)  │     │  AWS SigV4 auth · Binary/XML          │
└──────────────┘     └──────────┬────────────────────────────┘
                                │
┌──────────────┐     ┌──────────▼────────────────────────────┐
│   Browser    │────▶│  Admin API (:3001)                     │──▶  Telegram
│              │     │  JWT auth · JSON REST                  │     (MTProto)
└──────────────┘     └──────────┬────────────────────────────┘
                                │
                     ┌──────────▼────────────────────────────┐
                     │  Next.js Dashboard (:3000)             │
                     │  Proxies /api/* → Admin API            │
                     └───────────────────────────────────────┘
```

**Two separate NestJS servers** run in a single process:

| Server | Port | Auth | Purpose |
|--------|------|------|---------|
| Admin API | 3001 | JWT | Dashboard REST API |
| S3 API | 4000 | AWS SigV4 | S3-compatible object storage |

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Backend**: NestJS 11, Prisma 6 (SQLite), GramJS (Telegram MTProto)
- **Frontend**: Next.js 15, React 19, shadcn/ui, Tailwind CSS v4
- **Shared**: Pure TypeScript types and constants

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- A Telegram account
- Telegram API credentials (`api_id` and `api_hash` from [my.telegram.org](https://my.telegram.org))

### Setup

```bash
# Clone the repo
git clone https://github.com/user/telegram-s3.git
cd telegram-s3

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
cp .env.example apps/api/.env
# Edit both .env files with your settings

# Initialize the database
pnpm db:push

# Start all services
pnpm dev
```

The `.env` file must exist at **both** the repo root and `apps/api/.env` (Prisma reads `DATABASE_URL` before NestJS loads).

### Environment Variables

```env
# Admin Console
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
JWT_SECRET=your-secret-key-change-this

# Database (SQLite)
DATABASE_URL=file:./dev.db

# URLs
FRONTEND_URL=http://localhost:3000
ADMIN_API_URL=http://localhost:3001
S3_API_URL=http://localhost:4000
ADMIN_API_PORT=3001
S3_API_PORT=4000
```

### First Run

1. Open the dashboard at `http://localhost:3000` and log in with your admin credentials
2. Connect your Telegram account (you'll need your API ID, API hash, and phone number)
3. Create a bucket — this creates a private Telegram channel
4. Create an access key
5. Use any S3 client to interact with your storage

### Usage with AWS CLI

```bash
aws configure --profile tgs3
# Access Key ID: <from dashboard>
# Secret Access Key: <from dashboard>
# Region: us-east-1
# Output: json

# Create a bucket (or use the dashboard)
aws --profile tgs3 --endpoint-url http://localhost:4000 s3 mb s3://my-bucket

# Upload a file
aws --profile tgs3 --endpoint-url http://localhost:4000 s3 cp ./photo.jpg s3://my-bucket/photo.jpg

# List objects
aws --profile tgs3 --endpoint-url http://localhost:4000 s3 ls s3://my-bucket/

# Download a file
aws --profile tgs3 --endpoint-url http://localhost:4000 s3 cp s3://my-bucket/photo.jpg ./downloaded.jpg

# Delete a file
aws --profile tgs3 --endpoint-url http://localhost:4000 s3 rm s3://my-bucket/photo.jpg
```

## Project Structure

```
telegram-s3/
├── apps/
│   ├── api/          # NestJS backend (Admin API + S3 API)
│   │   ├── prisma/   # Prisma schema & SQLite database
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── admin/      # Auth & admin endpoints
│   │       │   ├── buckets/    # Bucket management
│   │       │   ├── keys/       # Access key management
│   │       │   ├── objects/    # Object storage logic
│   │       │   ├── telegram/   # Telegram MTProto client
│   │       │   └── s3/         # S3-compatible API layer
│   │       └── common/         # Guards, middleware, utils
│   └── web/          # Next.js admin dashboard
└── packages/
    └── shared/       # Shared TypeScript types & constants
```

## Development

```bash
pnpm dev              # Start all services
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm db:push          # Push schema changes to SQLite
pnpm db:migrate       # Create and apply a Prisma migration
pnpm db:generate      # Regenerate Prisma client
```

## License

MIT
