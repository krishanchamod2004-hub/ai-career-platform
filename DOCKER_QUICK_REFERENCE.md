# Docker Quick Reference Card

## 🚀 Quick Start (3 Steps)

```bash
# 1. Configure
cp .env.production.template .env.production
nano .env.production  # Set POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JOBSPY_API_TOKEN, URLs

# 2. Deploy
./docker.sh build && ./docker.sh up

# 3. Verify
./docker.sh health
```

## 📋 Essential Commands

| Task | Command |
|------|---------|
| **Build** | `./docker.sh build` |
| **Start** | `./docker.sh up` |
| **Stop** | `./docker.sh down` |
| **Logs** | `./docker.sh logs [service]` |
| **Status** | `./docker.sh ps` |
| **Health** | `./docker.sh health` |
| **Restart** | `./docker.sh restart [service]` |
| **Shell** | `./docker.sh shell <service>` |

## 🗄️ Database Commands

| Task | Command |
|------|---------|
| **Migrate** | `./docker.sh migrate` |
| **Seed** | `./docker.sh seed` |
| **Backup** | `./docker.sh backup` |
| **Shell** | `./docker.sh shell postgres` |
| **Query** | `docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_career_platform` |

## 🔍 Debugging

| Issue | Command |
|-------|---------|
| **View logs** | `./docker.sh logs api` |
| **Check health** | `./docker.sh health` |
| **Resource usage** | `./docker.sh stats` |
| **Service status** | `./docker.sh ps` |
| **Enter container** | `./docker.sh shell api` |

## 🌐 Service URLs

| Service | Internal URL | External URL (via Nginx) |
|---------|--------------|--------------------------|
| Web | http://localhost:3000 | https://yourdomain.com |
| API | http://localhost:4000/api | https://yourdomain.com/api |
| API Docs | http://localhost:4000/api/docs | https://yourdomain.com/api/docs |

## 🐳 Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| postgres | ai-career-postgres | 5432 | Database |
| redis | ai-career-redis | 6379 | Cache & Queues |
| jobspy | ai-career-jobspy | 8000 | Job Scraper |
| api | ai-career-api | 4000 | REST API |
| worker | ai-career-worker | - | Background Jobs |
| web | ai-career-web | 3000 | Frontend |

## ⚙️ Environment Variables (Required)

```bash
POSTGRES_PASSWORD=your_strong_password_here
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JOBSPY_API_TOKEN=$(openssl rand -hex 16)
WEB_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## 🔄 Common Workflows

### Initial Deployment
```bash
cp .env.production.template .env.production
# Edit .env.production
./docker.sh build
./docker.sh up
./docker.sh migrate
./docker.sh seed
./docker.sh health
```

### Update Code
```bash
git pull
./docker.sh build
./docker.sh down
./docker.sh up
./docker.sh migrate
./docker.sh health
```

### Backup & Restore
```bash
# Backup
./docker.sh backup

# Restore
cat backup-20260803.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres ai_career_platform
```

### Restart After Changes
```bash
./docker.sh restart api
./docker.sh restart worker
./docker.sh restart web
```

### Complete Reset (⚠️ DELETES DATA)
```bash
./docker.sh reset
```

## 📊 Monitoring

```bash
# Resource usage
./docker.sh stats

# Live logs
./docker.sh logs

# Service-specific logs
./docker.sh logs api
./docker.sh logs worker
./docker.sh logs web

# Health status
./docker.sh health
```

## 🐛 Troubleshooting Quick Fixes

### API not responding
```bash
./docker.sh logs api
./docker.sh restart api
```

### Worker not processing jobs
```bash
./docker.sh logs worker
./docker.sh restart worker
```

### Database connection issues
```bash
./docker.sh ps postgres
./docker.sh shell postgres
# Inside: psql -U postgres -d ai_career_platform
```

### Web shows errors
```bash
./docker.sh logs web
./docker.sh restart web
```

### Clean up disk space
```bash
./docker.sh clean
docker system prune -a --volumes  # ⚠️ Nuclear option
```

## 📁 File Structure

```
.
├── apps/
│   ├── api/Dockerfile          ← NestJS API + Worker
│   └── web/Dockerfile          ← Next.js Frontend
├── services/
│   └── jobspy/Dockerfile       ← Python Scraper
├── docker-compose.prod.yml     ← Orchestration
├── .dockerignore               ← Build exclusions
├── .npmrc                      ← PNPM config
├── .env.production             ← Your secrets (don't commit!)
├── .env.production.template    ← Template to copy
├── docker.sh                   ← Management utility ⭐
├── scripts/
│   ├── docker-build-deploy.sh  ← Automated deployment
│   └── verify-docker.sh        ← Health checks
└── DOCKER_README.md            ← Full documentation
```

## 🎯 Production Checklist

- [ ] Copy and configure `.env.production`
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Generate `JWT_ACCESS_SECRET`
- [ ] Generate `JOBSPY_API_TOKEN`
- [ ] Configure domain URLs
- [ ] Set up Nginx reverse proxy
- [ ] Configure SSL/TLS
- [ ] Run database migrations
- [ ] Test health checks
- [ ] Configure backups
- [ ] Set up monitoring

## 💡 Pro Tips

1. **Always backup before updates**: `./docker.sh backup`
2. **Check logs first**: `./docker.sh logs [service]`
3. **Use health checks**: `./docker.sh health`
4. **Monitor resources**: `./docker.sh stats`
5. **Tag your images**: Add version tags in builds
6. **Keep .env.production secure**: Never commit it
7. **Test locally first**: Use docker-compose.local.yml for dev

## 📚 Documentation

- **DOCKER_README.md** - Comprehensive guide
- **DOCKER_PRODUCTION.md** - Production deployment
- **DOCKER_CHANGES.md** - What changed and why
- **.env.production.template** - All environment variables

## 🆘 Emergency Commands

```bash
# View all logs immediately
docker compose -f docker-compose.prod.yml logs --tail=100

# Stop everything NOW
docker compose -f docker-compose.prod.yml down

# Nuclear reset (deletes everything)
./docker.sh reset

# Check if services are running
docker ps
```

## 🔗 Useful Docker Commands

```bash
# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything
docker system prune -a --volumes

# View container details
docker inspect ai-career-api

# View container logs
docker logs -f ai-career-api

# Execute command in container
docker exec -it ai-career-api sh
```

---

**Need more help?** Check `DOCKER_README.md` for detailed documentation.
