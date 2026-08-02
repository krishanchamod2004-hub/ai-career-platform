# Quick Start - Local Development

This guide will help you set up and run the AI Career Platform on your local machine for development.

## Prerequisites

Before starting, make sure you have:

- **Node.js 20+** - [Download here](https://nodejs.org/)
- **pnpm 9+** - Install with: `npm install -g pnpm`
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)

## Automated Setup (Recommended)

### Windows

Open PowerShell in the project root and run:

```powershell
.\setup-local.ps1
```

### Linux/Mac

Open terminal in the project root and run:

```bash
chmod +x setup-local.sh
./setup-local.sh
```

The script will automatically:
1. ✓ Check prerequisites (Node.js, pnpm, Docker)
2. ✓ Install dependencies
3. ✓ Build shared package
4. ✓ Create `.env` files with generated secrets
5. ✓ Start Docker infrastructure (PostgreSQL, Redis, JobSpy)
6. ✓ Run database migrations
7. ✓ Seed demo data

### After Setup

Start development servers:

```bash
# Option 1: Start both API and Web in parallel
pnpm dev

# Option 2: Start separately (in different terminals)
pnpm --filter=@ai-career/api run dev
pnpm --filter=@ai-career/web run dev
```

## Manual Setup

If you prefer manual setup or the automated script fails:

### Step 1: Install Dependencies

```bash
pnpm install
```

### Step 2: Build Shared Package

```bash
pnpm --filter=@ai-career/shared run build
```

### Step 3: Start Infrastructure

```bash
# Use dedicated local development compose file
docker compose -f docker-compose.local.yml up -d

# Or use main compose file with specific services
docker compose up postgres redis jobspy -d
```

### Step 4: Configure Environment

**API (.env):**
```bash
cd apps/api
cp .env.local .env
```

Edit `apps/api/.env` and set:
- `JWT_ACCESS_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Other values should work as-is

**Web (.env.local):**
```bash
cd apps/web
cp .env.local.template .env.local
```

### Step 5: Database Setup

```bash
# Run migrations
pnpm --filter=@ai-career/api run prisma:migrate:deploy

# Seed demo data (optional but recommended)
pnpm --filter=@ai-career/api run prisma:seed
```

### Step 6: Start Development Servers

```bash
# Terminal 1 - API
pnpm --filter=@ai-career/api run dev

# Terminal 2 - Web
pnpm --filter=@ai-career/web run dev
```

## Access the Application

Once everything is running:

| Service | URL | Description |
|---------|-----|-------------|
| **Web App** | http://localhost:3000 | Next.js frontend |
| **API** | http://localhost:4000/api | NestJS backend |
| **API Docs** | http://localhost:4000/api/docs | Swagger/OpenAPI UI |

## Demo Login Credentials

After running the seed script:

**Regular User (Premium Plan):**
- Email: `demo@aicareer.dev`
- Password: `Password123!`

**Admin User:**
- Email: `admin@aicareer.dev`
- Password: `Password123!`

## Common Commands

```bash
# Start infrastructure only
docker compose -f docker-compose.local.yml up -d

# Stop infrastructure
docker compose -f docker-compose.local.yml down

# View logs
docker compose -f docker-compose.local.yml logs -f

# Rebuild shared package (after changes)
pnpm --filter=@ai-career/shared run build

# Run database migrations
pnpm --filter=@ai-career/api run prisma:migrate:deploy

# Seed database
pnpm --filter=@ai-career/api run prisma:seed

# View database in Prisma Studio
pnpm --filter=@ai-career/api run prisma:studio

# Run tests
pnpm --filter=@ai-career/api run test

# Type check web app
pnpm --filter=@ai-career/web run type-check
```

## Troubleshooting

### Cannot connect to database

**Check if PostgreSQL is running:**
```bash
docker compose -f docker-compose.local.yml ps
```

**Verify DATABASE_URL in apps/api/.env:**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_career_platform?schema=public"
```

**Restart PostgreSQL:**
```bash
docker compose -f docker-compose.local.yml restart postgres
```

### Prisma CLI not found

Make sure you ran `pnpm install` from the project root. The Prisma CLI is installed as a dev dependency in `apps/api`.

Always run Prisma commands with the filter:
```bash
pnpm --filter=@ai-career/api run prisma:...
```

### Port already in use

**Windows (PowerShell):**
```powershell
# Find process using port 4000
netstat -ano | findstr :4000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Find and kill process using port 4000
lsof -ti:4000 | xargs kill -9
```

### Module not found: @ai-career/shared

Build the shared package:
```bash
pnpm --filter=@ai-career/shared run build
```

Or run from project root:
```bash
pnpm run prepare
```

### Invalid login credentials

Make sure you ran the seed:
```bash
pnpm --filter=@ai-career/api run prisma:seed
```

Or register a new user via:
- Web UI: http://localhost:3000/register
- API Docs: http://localhost:4000/api/docs (POST /api/auth/register)

### Docker services won't start

**Check if Docker Desktop is running**

**Check for port conflicts:**
```bash
# PostgreSQL port (5432)
netstat -ano | findstr :5432

# Redis port (6379)
netstat -ano | findstr :6379

# JobSpy port (8000)
netstat -ano | findstr :8000
```

**View Docker logs:**
```bash
docker compose -f docker-compose.local.yml logs
```

## Reset Everything

If you want to start fresh:

```bash
# Stop and remove containers and volumes
docker compose -f docker-compose.local.yml down -v

# Start fresh
docker compose -f docker-compose.local.yml up -d

# Rebuild and migrate
pnpm --filter=@ai-career/shared run build
pnpm --filter=@ai-career/api run prisma:migrate:deploy
pnpm --filter=@ai-career/api run prisma:seed
```

## Worker Process (Optional)

For local development, the API can run queue consumers inline by setting `RUN_WORKERS_IN_API=true` in `apps/api/.env`.

To run a dedicated worker process:

1. Set in `apps/api/.env`:
   ```
   RUN_WORKERS_IN_API=false
   ENABLE_SCHEDULER=false
   ```

2. Run worker in separate terminal:
   ```bash
   pnpm --filter=@ai-career/api run worker:dev
   ```

## Getting Help

- Check the full documentation in `README.md`
- Review `LOCAL_DEVELOPMENT.md` for more details
- Check API documentation at http://localhost:4000/api/docs
- Review logs: `docker compose -f docker-compose.local.yml logs -f`

## What's Running?

When everything is set up correctly:

1. **PostgreSQL** (localhost:5432) - Database
2. **Redis** (localhost:6379) - Cache & queue broker
3. **JobSpy** (localhost:8000) - Python scraper service
4. **API** (localhost:4000) - NestJS backend
5. **Web** (localhost:3000) - Next.js frontend

All infrastructure runs in Docker, while API and Web run directly on your host machine for hot reload and faster development.
