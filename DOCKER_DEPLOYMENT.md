# Production Docker Deployment Guide

## Overview

This deployment strategy follows SaaS production best practices:

✅ **Build Once, Run Anywhere** - Images built locally, deployed to any VPS  
✅ **No Source Code on VPS** - VPS only runs pre-built containers  
✅ **No Build Tools on VPS** - No Node.js, pnpm, or build dependencies needed  
✅ **Reproducible Builds** - Same image works identically everywhere  
✅ **Zero pnpm Symlink Issues** - Proper workspace handling eliminates "Cannot find module" errors  
✅ **Container Registry** - Images distributed via Docker Hub, GHCR, or private registry  

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Local Machine                            │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│  │  Build   │ → │   Tag    │ → │   Push   │                │
│  │  Images  │   │  Images  │   │ Registry │                │
│  └──────────┘   └──────────┘   └────┬─────┘                │
└──────────────────────────────────────┼──────────────────────┘
                                       │
                                       │ Docker Pull
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      VPS Server                              │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│  │   Pull   │ → │   Run    │ → │  Monitor │                │
│  │  Images  │   │Containers│   │  Logs    │                │
│  └──────────┘   └──────────┘   └──────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Local Machine
- Docker Desktop installed
- Docker Hub account OR GitHub account (for GHCR)
- Access to push images to registry

### VPS Server
- Ubuntu 20.04+ (or any Linux with Docker)
- Docker Engine installed
- Docker Compose V2 installed
- Nginx (optional, for reverse proxy)
- Ports 80/443 open (for web access)

## Setup Instructions

### 1. Configure Registry

Choose your container registry:

#### Option A: Docker Hub (Easiest)
```bash
export DOCKER_REGISTRY="your-dockerhub-username"
docker login
```

#### Option B: GitHub Container Registry (Recommended)
```bash
export DOCKER_REGISTRY="ghcr.io/your-github-username"
echo $GITHUB_TOKEN | docker login ghcr.io -u your-github-username --password-stdin
```

#### Option C: Private Registry
```bash
export DOCKER_REGISTRY="registry.example.com"
docker login registry.example.com
```

### 2. Configure Build Variables

Create `.env.build` on your local machine:

```bash
# Registry configuration
export DOCKER_REGISTRY="ghcr.io/your-username"
export IMAGE_TAG="latest"

# Next.js build-time variables (IMPORTANT!)
export NEXT_PUBLIC_API_URL="https://yourdomain.com/api"
export NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
```

Load the variables:
```bash
source .env.build
```

### 3. Build Images Locally

```bash
# Make script executable
chmod +x scripts/docker-build.sh

# Build all images
./scripts/docker-build.sh
```

This builds three images:
- `$DOCKER_REGISTRY/ai-career-api:latest`
- `$DOCKER_REGISTRY/ai-career-web:latest`
- `$DOCKER_REGISTRY/ai-career-jobspy:latest`

### 4. Test Images Locally (Optional)

```bash
# Create test .env
cp .env.vps.template .env
nano .env  # Configure for local testing

# Test with compose
docker compose -f docker-compose.prod.yml up

# Access:
# - Web: http://localhost:3000
# - API: http://localhost:4000/api
```

### 5. Push Images to Registry

```bash
# Make script executable
chmod +x scripts/docker-push.sh

# Push all images
./scripts/docker-push.sh
```

### 6. Deploy to VPS

#### Copy deployment files to VPS:
```bash
# From local machine
scp docker-compose.prod.yml user@your-vps:/opt/ai-career/
scp .env.vps.template user@your-vps:/opt/ai-career/.env.template
scp scripts/docker-deploy-vps.sh user@your-vps:/opt/ai-career/scripts/
```

#### Configure VPS:
```bash
# On VPS
cd /opt/ai-career

# Create .env from template
cp .env.template .env
nano .env  # Configure all variables

# IMPORTANT: Set these in .env
# DOCKER_REGISTRY=ghcr.io/your-username  (same as build)
# IMAGE_TAG=latest
# POSTGRES_PASSWORD=strong_password
# JWT_ACCESS_SECRET=$(openssl rand -hex 32)
# JOBSPY_API_TOKEN=$(openssl rand -hex 16)
# WEB_URL=https://yourdomain.com
# NEXT_PUBLIC_API_URL=https://yourdomain.com/api
# NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

#### Deploy:
```bash
# Make script executable
chmod +x scripts/docker-deploy-vps.sh

# Login to registry (if private)
docker login ghcr.io

# Run deployment
./scripts/docker-deploy-vps.sh
```

## Image Details

### API Image (~250MB)
- Node 20 Alpine
- NestJS compiled code
- Prisma Client generated
- Production dependencies only
- Runs as non-root user (nestjs:1001)
- Supports both API server and Worker process

### Web Image (~180MB)
- Node 20 Alpine
- Next.js standalone output
- All dependencies bundled
- No pnpm symlinks
- No "Cannot find module next" issues
- Runs as non-root user (nextjs:1001)

### JobSpy Image (~200MB)
- Python 3.12 slim
- FastAPI application
- Minimal dependencies
- Runs as non-root user (jobspy:1001)

## Common Commands

### Local Development

```bash
# Build images
./scripts/docker-build.sh

# Push images
./scripts/docker-push.sh

# Build specific service
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://yourdomain.com/api \
  --build-arg NEXT_PUBLIC_SITE_URL=https://yourdomain.com \
  -t $DOCKER_REGISTRY/ai-career-web:latest .
```

### VPS Deployment

```bash
# Deploy/update
./scripts/docker-deploy-vps.sh

# Or manually:
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart specific service
docker compose -f docker-compose.prod.yml restart api

# Run migrations
docker compose -f docker-compose.prod.yml exec api pnpm exec prisma migrate deploy

# Seed database
docker compose -f docker-compose.prod.yml exec api pnpm exec prisma db seed

# Shell access
docker compose -f docker-compose.prod.yml exec api sh
```

## Updating Deployment

### Option 1: Full Update (Code Changes)

On local machine:
```bash
# Pull latest code
git pull

# Rebuild images
source .env.build
./scripts/docker-build.sh

# Push updated images
./scripts/docker-push.sh
```

On VPS:
```bash
# Pull and restart
./scripts/docker-deploy-vps.sh
```

### Option 2: Configuration Only (No Code Changes)

On VPS:
```bash
# Update .env file
nano .env

# Restart services
docker compose -f docker-compose.prod.yml restart
```

## CI/CD with GitHub Actions

The included GitHub Actions workflow automatically:
1. Builds images on every push to `main`
2. Pushes to GitHub Container Registry
3. Tags with version and timestamp

### Setup:

1. Add secrets to GitHub repository:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_SITE_URL`

2. Push to main branch:
```bash
git push origin main
```

3. Images automatically built and pushed to:
   - `ghcr.io/username/ai-career-api:latest`
   - `ghcr.io/username/ai-career-web:latest`
   - `ghcr.io/username/ai-career-jobspy:latest`

4. Deploy on VPS:
```bash
export DOCKER_REGISTRY="ghcr.io/username/ai-career"
./scripts/docker-deploy-vps.sh
```

## Troubleshooting

### "Cannot find module 'next'" Error
✅ **SOLVED** - The new Dockerfile properly handles Next.js standalone output. This error should not occur.

If it does occur:
1. Check that `output: 'standalone'` is set in `next.config.js`
2. Verify image was built with proper NEXT_PUBLIC_* variables
3. Rebuild image: `./scripts/docker-build.sh`

### pnpm Symlink Issues
✅ **SOLVED** - Using `node-linker=hoisted` eliminates symlink problems in Docker.

### Image Won't Pull on VPS
```bash
# Login to registry
docker login ghcr.io

# Verify DOCKER_REGISTRY in .env
cat .env | grep DOCKER_REGISTRY

# Try pulling manually
docker pull ghcr.io/username/ai-career-web:latest
```

### Service Won't Start
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs service-name

# Check environment
docker compose -f docker-compose.prod.yml config

# Verify health
docker compose -f docker-compose.prod.yml ps
```

### Database Connection Issues
```bash
# Check postgres health
docker compose -f docker-compose.prod.yml ps postgres

# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_career_platform
```

## Security Best Practices

✅ All images run as non-root users  
✅ Minimal base images (Alpine)  
✅ Production dependencies only  
✅ No exposed ports (use Nginx reverse proxy)  
✅ Secrets in environment variables  
✅ Health checks enabled  
✅ Logging configured  

## Performance Optimization

### Build Cache
Docker layer caching speeds up rebuilds:
- Dependencies installed before code copy
- Only changed layers rebuilt
- pnpm store cache mount

### Image Size
Multi-stage builds minimize final image size:
- Build dependencies removed
- Only runtime files included
- Alpine base images

### Runtime Performance
- Health checks prevent traffic to unhealthy services
- Restart policies handle failures
- Resource limits can be added in compose file

## Monitoring

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# Service-specific logs
docker compose -f docker-compose.prod.yml logs -f api

# Resource usage
docker stats

# Service status
docker compose -f docker-compose.prod.yml ps
```

## Backup and Restore

### Backup Database
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres ai_career_platform > backup-$(date +%Y%m%d).sql
```

### Restore Database
```bash
cat backup-20260803.sql | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres ai_career_platform
```

## Cost Optimization

### Registry Storage
- Use image tags effectively
- Clean up old images
- Consider registry limits (Docker Hub free tier: unlimited public, 1 private)

### VPS Resources
Minimum recommended:
- 2 CPU cores
- 4GB RAM
- 20GB disk
- Ubuntu 22.04 LTS

## Support

For issues with this deployment system:
1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Verify environment: `docker compose -f docker-compose.prod.yml config`
3. Review this documentation
4. Check Docker/container registry status

## Summary

This deployment system provides:

✅ **Production-Ready** - Battle-tested best practices  
✅ **Reproducible** - Same image runs identically everywhere  
✅ **Secure** - Non-root users, minimal images  
✅ **Scalable** - Easy to add more workers/services  
✅ **Maintainable** - Clear separation of concerns  
✅ **Fast** - Optimized builds and deploys  
✅ **Simple** - VPS never builds, only runs  

**Build locally. Push to registry. Deploy anywhere.**
