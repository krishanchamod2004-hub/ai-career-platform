# Quick Start Guide - Local Development

## Step 1: Start Infrastructure (Database + Redis)

Open a terminal in the project root and run:

```bash
docker compose up postgres redis -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

**Verify it's running:**
```bash
docker compose ps
```

You should see `postgres` and `redis` with status "Up".

---

## Step 2: Configure Backend Environment

1. **Copy environment file:**
   ```bash
   cd apps/api
   cp .env.example .env
   ```

2. **Edit `apps/api/.env`** and set these required values:

   ```bash
   # JWT Secret (required)
   JWT_ACCESS_SECRET="your-secret-key-here-make-it-long-and-random"
   
   # Database (should work as-is with Docker Compose)
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_career_platform?schema=public"
   
   # Redis (should work as-is)
   REDIS_URL="redis://localhost:6379"
   
   # Google OAuth (OPTIONAL - only needed for "Continue with Google")
   GOOGLE_CLIENT_ID=""
   GOOGLE_CLIENT_SECRET=""
   GOOGLE_CALLBACK_URL="http://localhost:4000/api/auth/google/callback"
   ```

   **Generate a secure JWT secret** (run this in terminal):
   ```bash
   # PowerShell (Windows)
   -join ((1..64) | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 126) })
   
   # Or use any long random string
   ```

---

## Step 3: Run Database Migrations

Still in `apps/api` directory:

```bash
pnpm prisma migrate deploy
```

This creates all database tables.

---

## Step 4: Seed Demo Data (Optional but Recommended)

```bash
pnpm prisma:seed
```

This creates two test users:

| Email | Password | Role |
|-------|----------|------|
| `demo@aicareer.dev` | `Password123!` | USER (Premium plan) |
| `admin@aicareer.dev` | `Password123!` | ADMIN |

**Use these to log in!**

---

## Step 5: Start Backend API

**Option A - Development mode with hot reload:**
```bash
cd apps/api
pnpm dev
```

**Option B - From project root:**
```bash
pnpm --filter=@ai-career/api run dev
```

You should see:
```
[Nest] Application successfully started
Listening on http://localhost:4000
```

**Test it**: Open http://localhost:4000/api/docs (Swagger UI)

---

## Step 6: Start Frontend

Open a **NEW terminal** (keep API running in the first one):

```bash
cd apps/web
pnpm dev
```

Or from project root:
```bash
pnpm --filter=@ai-career/web run dev
```

You should see:
```
- Local: http://localhost:3000
```

---

## Step 7: Log In

1. Open browser: http://localhost:3000/login

2. Use demo credentials:
   - **Email**: `demo@aicareer.dev`
   - **Password**: `Password123!`

3. Click "Log in"

4. You should be redirected to the dashboard!

---

## Troubleshooting

### "Cannot reach the server"

**Check if API is running:**
```bash
curl http://localhost:4000/api/health
```

Should return: `{"status":"ok"}`

If not, check:
1. Is the API terminal showing errors?
2. Is PostgreSQL running? `docker compose ps`
3. Is port 4000 already in use by another app?

---

### "Invalid email or password"

**Make sure you ran the seed:**
```bash
cd apps/api
pnpm prisma:seed
```

**Or create a user manually via Swagger:**
1. Go to http://localhost:4000/api/docs
2. Find `POST /api/auth/register`
3. Click "Try it out"
4. Fill in:
   ```json
   {
     "name": "Your Name",
     "email": "your@email.com",
     "password": "YourPassword123!"
   }
   ```
5. Click "Execute"

---

### Database connection error

**Check DATABASE_URL in `apps/api/.env`:**
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_career_platform?schema=public"
```

**Make sure Docker Compose is running:**
```bash
docker compose up postgres redis -d
```

---

### "Port 4000 already in use"

**Find and kill the process:**

Windows PowerShell:
```powershell
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

Linux/Mac:
```bash
lsof -ti:4000 | xargs kill -9
```

---

## Full Startup Script (All-in-One)

Create a file `start-dev.ps1` (Windows) or `start-dev.sh` (Linux/Mac):

**Windows (start-dev.ps1):**
```powershell
# Start infrastructure
docker compose up postgres redis -d

# Wait for database
Start-Sleep -Seconds 5

# Start API (in background job)
Start-Job -ScriptBlock { 
    cd apps/api
    pnpm dev 
}

# Wait for API to start
Start-Sleep -Seconds 10

# Start web
cd apps/web
pnpm dev
```

**Run it:**
```bash
.\start-dev.ps1
```

---

## Quick Commands Reference

```bash
# Start infrastructure
docker compose up postgres redis -d

# Start API (terminal 1)
pnpm --filter=@ai-career/api run dev

# Start web (terminal 2)
pnpm --filter=@ai-career/web run dev

# Stop everything
docker compose down
```

---

## What's Running?

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Next.js web app |
| Backend API | http://localhost:4000/api | NestJS REST API |
| API Docs | http://localhost:4000/api/docs | Swagger UI |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache + queues |

---

## Default Login Credentials

After running `pnpm prisma:seed`:

**Regular User (Premium Plan):**
- Email: `demo@aicareer.dev`
- Password: `Password123!`

**Admin User:**
- Email: `admin@aicareer.dev`  
- Password: `Password123!`

**IMPORTANT**: Change these passwords in production!
