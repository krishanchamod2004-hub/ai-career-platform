# Quick Deployment Guide

This guide shows you how to pull the latest code and deploy with Docker.

## Prerequisites

- Git installed
- Docker and Docker Compose installed
- SSH access to your server

## Step-by-Step Deployment

### Step 1: Connect to Your Server

```bash
ssh your-user@your-server-ip
```

### Step 2: Navigate to Project Directory

```bash
cd /path/to/ai-career-platform
# Or wherever you cloned the repository
```

### Step 3: Pull Latest Code from GitHub

```bash
# Pull the latest changes
git pull origin main
```

### Step 4: Setup Environment Variables

#### First Time Setup:
```bash
# Copy the production template
cp .env.production.template .env

# Edit with your actual values
nano .env
# Or use vim: vim .env
```

#### Update These Values in .env:

```bash
# Database password (generate a strong one)
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE
DATABASE_URL=postgresql://postgres:YOUR_SECURE_PASSWORD_HERE@postgres:5432/ai_career_platform?schema=public

# JWT Secret (generate with: openssl rand -hex 32)
JWT_ACCESS_SECRET=YOUR_JWT_SECRET_HERE

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback

# Your domains
WEB_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# JobSpy token (generate with: openssl rand -hex 32)
JOBSPY_API_TOKEN=YOUR_JOBSPY_TOKEN_HERE
```

**Save and exit:**
- In nano: Press `Ctrl+X`, then `Y`, then `Enter`
- In vim: Press `Esc`, type `:wq`, press `Enter`

### Step 5: Start Docker Containers

#### For Production:

```bash
# Stop any running containers
docker compose -f docker-compose.prod.yml down

# Pull latest images (if using pre-built images from GitHub)
docker compose -f docker-compose.prod.yml pull

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Or without rebuild (faster if no code changes):
docker compose -f docker-compose.prod.yml up -d
```

#### For Local Development:

```bash
# Stop containers
docker compose down

# Start services
docker compose up -d --build
```

### Step 6: Check Container Status

```bash
# View running containers
docker compose ps

# Should show:
# - postgres (database)
# - redis (cache/queue)
# - jobspy (scraper)
# - api (backend)
# - worker (queue processor)
# - web (frontend)
```

### Step 7: View Logs

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f web
docker compose logs -f worker

# Exit logs: Press Ctrl+C
```

### Step 8: Run Database Migrations (First Time Only)

```bash
# Run migrations
docker compose exec api pnpm prisma:migrate:deploy

# Seed demo data (optional)
docker compose exec api pnpm prisma:seed
```

### Step 9: Verify Deployment

**Check API:**
```bash
curl https://api.yourdomain.com/api/health
# Should return: {"status":"ok"}
```

**Check Web:**
- Open browser: `https://yourdomain.com`
- Should see the landing page

**Check Admin Dashboard:**
- Login with admin credentials
- Go to Dashboard → Admin
- Check scraper status and queues

## Common Docker Commands

### Starting and Stopping

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart a specific service
docker compose restart api

# Stop and remove all containers + volumes (CAREFUL: deletes data!)
docker compose down -v
```

### Updating After Code Changes

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Or rebuild specific service
docker compose -f docker-compose.prod.yml up -d --build api
```

### Viewing Logs

```bash
# All logs (live follow)
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Specific service
docker compose logs -f api

# Save logs to file
docker compose logs > deployment.log
```

### Accessing Containers

```bash
# Access API container shell
docker compose exec api sh

# Access database
docker compose exec postgres psql -U postgres -d ai_career_platform

# Run commands in container
docker compose exec api pnpm prisma:studio
```

### Checking Resources

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## Complete Deployment Script

Save this as `deploy.sh` for quick deployments:

```bash
#!/bin/bash

echo "🚀 Starting deployment..."

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found! Creating from template..."
    cp .env.production.template .env
    echo "❌ Please edit .env with your actual values and run this script again"
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

# Pull latest images
echo "📦 Pulling latest Docker images..."
docker compose -f docker-compose.prod.yml pull

# Build and start services
echo "🔨 Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if API is up
echo "🔍 Checking API health..."
API_HEALTH=$(docker compose exec -T api wget -q -O - http://localhost:4000/api/health 2>/dev/null)
if [[ $API_HEALTH == *"ok"* ]]; then
    echo "✅ API is healthy!"
else
    echo "⚠️  API health check failed"
fi

# Show status
echo "📊 Container status:"
docker compose ps

echo "✅ Deployment complete!"
echo ""
echo "📝 View logs with: docker compose logs -f"
echo "🌐 Web: https://careersuite.cc"
echo "🔧 API: https://api.careersuite.cc"
```

Make it executable:
```bash
chmod +x deploy.sh
./deploy.sh
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs api

# Check container status
docker compose ps

# Recreate container
docker compose up -d --force-recreate api
```

### Database connection error

```bash
# Check if postgres is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Verify DATABASE_URL in .env matches POSTGRES_PASSWORD
```

### Port already in use

```bash
# Find what's using the port
lsof -i :4000  # On Linux/Mac
netstat -ano | findstr :4000  # On Windows

# Kill the process or change ports in docker-compose.yml
```

### Out of disk space

```bash
# Clean up Docker resources
docker system prune -a --volumes

# Remove old images
docker image prune -a
```

### Cannot access website

1. **Check nginx/reverse proxy** is configured correctly
2. **Check DNS** is pointing to your server IP
3. **Check SSL certificates** are valid
4. **Check firewall** allows ports 80 and 443

## Quick Reference

| Task | Command |
|------|---------|
| Pull latest code | `git pull origin main` |
| Start production | `docker compose -f docker-compose.prod.yml up -d` |
| Stop all | `docker compose down` |
| Restart API | `docker compose restart api` |
| View logs | `docker compose logs -f` |
| Check status | `docker compose ps` |
| Run migrations | `docker compose exec api pnpm prisma:migrate:deploy` |
| Access shell | `docker compose exec api sh` |

## Related Documentation

- [Full Deployment Guide](./DEPLOYMENT.md) - Complete VPS setup
- [Production Environment](./PRODUCTION_ENV.md) - Environment variables explained
- [README](./README.md) - Project overview

---

**Need help?** Check the logs first: `docker compose logs -f`
