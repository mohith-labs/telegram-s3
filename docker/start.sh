#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/apps/api && npx prisma migrate deploy

echo "Starting API server..."
node /app/apps/api/dist/main.js &

echo "Starting Web server..."
cd /app && node apps/web/server.js
