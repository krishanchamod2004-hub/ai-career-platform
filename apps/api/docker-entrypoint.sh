#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx --no-install prisma migrate deploy --schema=./prisma/schema.prisma

# Seed the database (idempotent - uses upsert)
# Check if job_sources table has data to determine if seeding is needed
# Users may exist from previous seeds, but job_sources is the real indicator
# Do NOT crash the container if seeding fails - API must start regardless
echo "Checking if database needs seeding..."

# Disable exit-on-error for the seed check to prevent container crashes
set +e
JOB_SOURCE_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.jobSource.count()
  .then(count => { console.log(count); process.exit(0); })
  .catch(() => { console.log(0); process.exit(0); })
  .finally(() => prisma.\$disconnect());
" 2>/dev/null)
SEED_CHECK_EXIT=$?
set -e

# If the check failed completely or returned empty, default to 0 (run seed)
if [ $SEED_CHECK_EXIT -ne 0 ] || [ -z "$JOB_SOURCE_COUNT" ]; then
  echo "Could not check job source count. Will attempt seeding..."
  JOB_SOURCE_COUNT=0
fi

if [ "$JOB_SOURCE_COUNT" = "0" ]; then
  echo "Database is empty (no job sources). Running seed..."
  # Disable exit-on-error for seed execution
  set +e
  node dist/prisma/seed.js
  SEED_EXIT=$?
  set -e
  
  if [ $SEED_EXIT -eq 0 ]; then
    echo "✓ Seed completed successfully."
  else
    echo "⚠ WARNING: Seed failed (exit code: $SEED_EXIT), but continuing startup..."
    echo "  You can seed manually later with: node dist/prisma/seed.js"
  fi
else
  echo "Database already contains $JOB_SOURCE_COUNT job sources. Skipping seed."
fi

echo "Starting API server..."
exec node dist/main.js
