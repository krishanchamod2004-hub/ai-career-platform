#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx --no-install prisma migrate deploy --schema=./prisma/schema.prisma

echo "Running Prisma seed (idempotent - uses upsert)..."
npx --no-install prisma db seed --schema=./prisma/schema.prisma

echo "Starting API server..."
exec node dist/main.js
