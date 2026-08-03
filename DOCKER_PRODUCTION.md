# Docker Production Deployment Guide

Complete rewrite of Docker infrastructure optimized for production VPS deployment.

## Architecture

```
┌─────────────┐
│   Nginx     │ ← Reverse Proxy (SSL/TLS)
│  (Port 80)  │
│  (Port 443) │
└──────┬──────┘
       │
       ├─────────────┐
       │             │
┌──────▼──────┐ ┌───▼────────┐
│    Web      │ │    API     │
│ (Next.js)   │ │  (NestJS)  │
│   :3000     │ │   :4000    │
└─────────────┘ └────┬───────┘
                     │
       ┌─────────────┼─────────────┬────────────┐
       │             │             │            │
┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐ ┌──▼──────┐
│   Worker    │ │ Redis  │ │  PostgreSQL │ │ JobSpy  │
│  (BullMQ)   │ │        │ │             │ │ (Python)│
└─────────────┘ └────────┘ └─────────────┘ └─────────┘
```

## Key Improvements

### 1. PNPM Workspace Handling
- ✅ Proper workspace dependency resolution
- ✅ Correct symlink handling
- ✅ No duplicate node_modules
- ✅ Optimized layer caching

### 2. Next.js Standalone
- ✅ Minimal runtime image
- ✅ All dependencies properly copied
- ✅ No "Cannot find module 'next'" errors
- ✅ Correct static asset paths

### 3. Multi-Stage Builds
- ✅ Separate dependency, build, and runtime stages
- ✅ Production-only dependencies in final image
- ✅ Minimized image sizes
- ✅ Build cache optimization

### 4. Security
- ✅ Non-root users (nodejs, nestjs, jobspy)
- ✅ Minimal base images (alpine)
- ✅ No unnecessary packages
- ✅ Proper signal handling (dumb-init, tini)

### 5. Production Ready
- ✅ Health checks on all services
- ✅ Restart policies
- ✅ Proper logging configuration
- ✅ Resource limits
- ✅ Internal-only networking

## Quick Start

### 1. Environment Setup

```bash
# Copy and configure environment file
cp .env.production.template .env.production

# Edit with your values
nano .env.production
```

**Required Variables:**
- `POSTGRES_PASSWORD` - Strong database password
- `JWT_ACCESS_SECRET` - Generate with `openssl rand -hex 32`
- `JOBSPY_API_TOKEN` - Generate with `openssl rand -hex 16`
- `WEB_URL` - Your production domain (https://yourdomain.com)
- `NEXT_PUBLIC_API_URL` - Your API URL (https://yourdomain.com/api)
- `NEXT_PUBLIC_SITE_URL` - Same as WEB_URL

### 2. Build Images

```bash
# Option A: Build all at once
docker compose -f docker-compose.prod.yml build

# Option B: Build individually
docker build -f apps/web/Dockerfile -t ai-career/web:latest .
docker build -f apps/api/Dockerfile -t ai-career/api:latest .
docker build -f services/jobspy/Dockerfile -t ai-career/jobspy:latest services/jobspy
```

### 3. Deploy

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Check status
docker compose -f docker-compose.prod.yml ps
```

### 4. Database Migration

```bash
# Run migrations
docker compose -f docker-compose.prod.yml exec api pnpm exec prisma migrate deploy

# Seed demo data (optional)
docker compose -f docker-compose.prod.yml exec api pnpm exec prisma db seed
```

## Services

### PostgreSQL
- **Internal Port:** 5432
- **Data:** Persistent volume `ai-career-postgres-data`
- **Access:** Internal only (no exposed ports)

### Redis
- **Internal Port:** 6379
- **Data:** Persistent volume `ai-career-redis-data`
- **Access:** Internal only

### JobSpy
- **Internal Port:** 8000
- **Image:** Python 3.12 slim
- **Access:** Internal only

### API
- **Internal Port:** 4000
- **Image:** Node 20 alpine
- **Exposed Via:** Nginx reverse proxy
- **Health:** http://localhost:4000/api/health

### Worker
- **Process:** node dist/worker.js
- **Image:** Same as API
- **Function:** BullMQ job processing

### Web
- **Internal Port:** 3000
- **Image:** Node 20 alpine
- **Exposed Via:** Nginx reverse proxy
- **Mode:** Next.js standalone

## Nginx Configuration

See `nginx/` directory for reverse proxy setup.

```nginx
# Web (port 3000) → https://yourdomain.com
# API (port 4000) → https://yourdomain.com/api
```

## Commands

### Build & Deploy
```bash
# Build and deploy in one command
./scripts/docker-build-deploy.sh

# Or manually
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
```

### Status
```bash
# Service status
docker compose -f docker-compose.prod.yml ps

# Health checks
docker compose -f docker-compose.prod.yml exec api curl http://localhost:4000/api/health
docker compose -f docker-compose.prod.yml exec web curl http://localhost:3000/
```

### Stop & Remove
```bash
# Stop services
docker compose -f docker-compose.prod.yml stop

# Stop and remove containers
docker compose -f docker-compose.prod.yml down

# Remove everything including volumes (⚠️ DELETES DATA)
docker compose -f docker-compose.prod.yml down -v
```

### Database Access
```bash
# PostgreSQL shell
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_career_platform

# Redis CLI
docker compose -f docker-compose.prod.yml exec redis redis-cli
```

### Restart Services
```bash
# Restart specific service
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart worker
docker compose -f docker-compose.prod.yml restart web

# Restart all
docker compose -f docker-compose.prod.yml restart
```

### Update Deployment
```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Or use the script
./scripts/docker-build-deploy.sh
```

## Troubleshooting

### "Cannot find module 'next'"
✅ Fixed in new Dockerfile - proper standalone output handling

### Web container crashes immediately
Check logs:
```bash
docker compose -f docker-compose.prod.yml logs web
```

Verify build args were set:
```bash
docker compose -f docker-compose.prod.yml config | grep NEXT_PUBLIC
```

### API cannot connect to database
Check PostgreSQL health:
```bash
docker compose -f docker-compose.prod.yml ps postgres
```

Verify DATABASE_URL in `.env.production`

### Worker not processing jobs
Check worker logs:
```bash
docker compose -f docker-compose.prod.yml logs worker
```

Verify `ENABLE_SCHEDULER=true` in worker environment

### Disk space issues
Clean up old images and containers:
```bash
docker system prune -a --volumes
```

## Image Sizes

Optimized multi-stage builds:

- **web**: ~180MB (Next.js standalone)
- **api**: ~250MB (NestJS + Prisma)
- **jobspy**: ~200MB (Python slim)

## Performance Tips

1. **Build Cache**: Use `--cache-from` for faster rebuilds
2. **Parallel Builds**: Build images in parallel
3. **Resource Limits**: Add memory/CPU limits in compose file
4. **Log Rotation**: Configured (10-50MB per service)

## Security Checklist

- ✅ Non-root users
- ✅ No exposed internal ports
- ✅ Minimal base images
- ✅ Production dependencies only
- ✅ Secrets in environment variables
- ✅ Health checks enabled
- ✅ Logging configured

## Monitoring

View resource usage:
```bash
docker stats
```

Service-specific stats:
```bash
docker stats ai-career-web ai-career-api ai-career-worker
```

## Backup

### Database Backup
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres ai_career_platform > backup.sql
```

### Volume Backup
```bash
docker run --rm -v ai-career-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Restore

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres ai_career_platform
```

## Production Checklist

Before going live:

1. ✅ Set strong passwords in `.env.production`
2. ✅ Configure domain names (WEB_URL, NEXT_PUBLIC_*)
3. ✅ Set up Nginx reverse proxy with SSL
4. ✅ Configure firewall (only 80/443 exposed)
5. ✅ Set up log rotation
6. ✅ Configure database backups
7. ✅ Test health checks
8. ✅ Run database migrations
9. ✅ Set up monitoring
10. ✅ Test OAuth callbacks (if using Google)

## Support

For issues with this Docker setup:
1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Check health: `docker compose -f docker-compose.prod.yml ps`
3. Verify environment variables
4. Review this documentation

## License

Same as parent project.
