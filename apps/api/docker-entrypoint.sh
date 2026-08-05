#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx --no-install prisma migrate deploy --schema=./prisma/schema.prisma

# Seed the database (idempotent - uses upsert)
# Skip if data already exists to avoid unnecessary processing
# Do NOT crash the container if seeding fails
echo "Checking if database needs seeding..."
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.count()
  .then(count => { console.log(count); process.exit(0); })
  .catch(() => { console.log(0); process.exit(0); })
  .finally(() => prisma.\$disconnect());
")

if [ "$USER_COUNT" = "0" ]; then
  echo "Database is empty. Running seed..."
  if node dist/seed.js; then
    echo "Seed completed successfully."
  else
    echo "WARNING: Seed failed, but continuing startup..."
    echo "You can seed manually later with: node dist/seed.js"
  fi
else
  echo "Database already contains $USER_COUNT users. Skipping seed."
fi

echo "Starting API server..."
exec node dist/main.js
