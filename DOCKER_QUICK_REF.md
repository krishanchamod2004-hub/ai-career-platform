# Docker Deployment Quick Reference

## 🚀 Quick Start (3 Steps)

### Local Machine
```bash
# 1. Configure
export DOCKER_REGISTRY="ghcr.io/your-username"
export NEXT_PUBLIC_API_URL="https://yourdomain.com/api"
export NEXT_PUBLIC_SITE_URL="https://yourdomain.com"

# 2. Build and Push
./scripts/docker-build.sh
./scripts/docker-push.sh
```

### VPS
```bash
# 3. Deploy
cp .env.vps.template .env
nano .env  # Configure
./scripts/docker-deploy-vps.sh
```

## 📦 Image Registry

| Registry | Format | Login Command |
|----------|--------|---------------|
| **Docker Hub** | `username/ai-career` | `docker login` |
| **GitHub** | `ghcr.io/username/ai-career` | `docker login ghcr.io` |
| **Private** | `registry.example.com/ai-career` | `docker login registry.example.com` |

## 🛠️ Build Commands

```bash
# Set registry
export DOCKER_REGISTRY="ghcr.io/username"

# Build all images
./scripts/docker-build.sh

# Build specific image
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://yourdomain.com/api \
  --build-arg NEXT_PUBLIC_SITE_URL=https://yourdomain.com \
  -t $DOCKER_REGISTRY/ai-career-web:latest .

# Push all images
./scripts/docker-push.sh

# Push specific image
docker push $DOCKER_REGISTRY/ai-career-web:latest
```

## 🚢 VPS Deployment

```bash
# Initial setup
cd /opt/ai-career
cp .env.vps.template .env
nano .env

# Deploy
./scripts/docker-deploy-vps.sh

# Or manually
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Migrations
docker compose -f docker-compose.prod.yml exec api pnpm exec prisma migrate deploy
```

## 📊 Monitoring

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api

# Service status
docker compose -f docker-compose.prod.yml ps

# Resource usage
docker stats

# Health check
curl http://localhost:4000/api/health
```

## 🔄 Updates

```bash
# Local: Rebuild and push
git pull
source .env.build
./scripts/docker-build.sh
./scripts/docker-push.sh

# VPS: Pull and restart
./scripts/docker-deploy-vps.sh
```

## 🐛 Troubleshooting

```bash
# View service logs
docker compose -f docker-compose.prod.yml logs service-name

# Restart service
docker compose -f docker-compose.prod.yml restart service-name

# Shell access
docker compose -f docker-compose.prod.yml exec api sh

# Database access
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_career_platform

# Check configuration
docker compose -f docker-compose.prod.yml config
```

## 💾 Backup & Restore

```bash
# Backup database
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres ai_career_platform > backup.sql

# Restore database
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres ai_career_platform
```

## ⚙️ Essential Environment Variables

### .env.build (Local Machine)
```bash
DOCKER_REGISTRY=ghcr.io/username
IMAGE_TAG=latest
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### .env (VPS)
```bash
DOCKER_REGISTRY=ghcr.io/username
IMAGE_TAG=latest
POSTGRES_PASSWORD=strong_password
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JOBSPY_API_TOKEN=$(openssl rand -hex 16)
WEB_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## 🔐 Security Checklist

- [ ] Strong `POSTGRES_PASSWORD`
- [ ] Random `JWT_ACCESS_SECRET` (32 bytes)
- [ ] Random `JOBSPY_API_TOKEN` (16 bytes)
- [ ] HTTPS enabled (Nginx + SSL)
- [ ] Firewall configured (only 80/443 open)
- [ ] `.env` file secured (chmod 600)
- [ ] Regular backups configured
- [ ] Log monitoring enabled

## 📝 Image Sizes

| Image | Size | Base |
|-------|------|------|
| **API** | ~250MB | Node 20 Alpine |
| **Web** | ~180MB | Node 20 Alpine |
| **JobSpy** | ~200MB | Python 3.12 Slim |

## 🎯 Key Features

✅ **No "Cannot find module next" errors**  
✅ **No pnpm symlink issues**  
✅ **Build once, run anywhere**  
✅ **No source code on VPS**  
✅ **Reproducible builds**  
✅ **Production-optimized**  

## 📚 Documentation

- **Full Guide:** `DOCKER_DEPLOYMENT.md`
- **VPS Template:** `.env.vps.template`
- **Build Script:** `scripts/docker-build.sh`
- **Push Script:** `scripts/docker-push.sh`
- **Deploy Script:** `scripts/docker-deploy-vps.sh`

## 🆘 Emergency Commands

```bash
# Stop everything
docker compose -f docker-compose.prod.yml down

# View last 100 lines of logs
docker compose -f docker-compose.prod.yml logs --tail=100

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Nuclear reset (⚠️ DELETES DATA)
docker compose -f docker-compose.prod.yml down -v
```

---

**Need help?** Check `DOCKER_DEPLOYMENT.md` for detailed documentation.
