# Pre-Deployment Checklist

Complete this checklist before deploying to production.

## ✅ Local Machine Setup

### Container Registry
- [ ] Registry account created (Docker Hub / GHCR / Private)
- [ ] Docker login successful
- [ ] `DOCKER_REGISTRY` environment variable set
- [ ] Registry format correct (examples below)

**Registry Format Examples:**
```bash
# Docker Hub
export DOCKER_REGISTRY="your-dockerhub-username"

# GitHub Container Registry (Recommended)
export DOCKER_REGISTRY="ghcr.io/your-github-username"

# Private Registry
export DOCKER_REGISTRY="registry.example.com"
```

### Build Environment
- [ ] Docker Desktop installed and running
- [ ] Node.js 20+ installed (for local testing)
- [ ] pnpm 9+ installed (for local testing)
- [ ] Git repository up to date (`git pull`)
- [ ] `.env.build` file created with variables:
  ```bash
  export DOCKER_REGISTRY="..."
  export IMAGE_TAG="latest"
  export NEXT_PUBLIC_API_URL="https://yourdomain.com/api"
  export NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
  ```

### Build Process
- [ ] Environment variables loaded (`source .env.build`)
- [ ] Scripts executable (`chmod +x scripts/docker-*.sh`)
- [ ] Build script runs successfully (`./scripts/docker-build.sh`)
- [ ] All three images built:
  - [ ] `$DOCKER_REGISTRY/ai-career-api:latest`
  - [ ] `$DOCKER_REGISTRY/ai-career-web:latest`
  - [ ] `$DOCKER_REGISTRY/ai-career-jobspy:latest`

### Local Testing (Optional but Recommended)
- [ ] Test `.env` file created
- [ ] `docker-compose.prod.yml` tested locally
- [ ] Web accessible at http://localhost:3000
- [ ] API accessible at http://localhost:4000/api
- [ ] Health checks passing
- [ ] Database migrations successful

### Push to Registry
- [ ] Push script runs successfully (`./scripts/docker-push.sh`)
- [ ] All images pushed to registry
- [ ] Images visible in registry web UI

---

## ✅ VPS Server Setup

### Prerequisites
- [ ] Ubuntu 20.04+ (or compatible Linux distribution)
- [ ] Root or sudo access
- [ ] Ports 80 and 443 open
- [ ] Domain name pointing to VPS IP

### Docker Installation
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose V2
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify
docker --version
docker compose version
```

- [ ] Docker Engine installed
- [ ] Docker Compose V2 installed
- [ ] Current user in docker group
- [ ] Docker commands work without sudo

### File Transfer
```bash
# Create directory
ssh user@vps "sudo mkdir -p /opt/ai-career/scripts"

# Copy files
scp docker-compose.prod.yml user@vps:/opt/ai-career/
scp .env.vps.template user@vps:/opt/ai-career/
scp scripts/docker-deploy-vps.sh user@vps:/opt/ai-career/scripts/
```

- [ ] Deployment directory created (`/opt/ai-career`)
- [ ] `docker-compose.prod.yml` copied
- [ ] `.env.vps.template` copied
- [ ] Deployment script copied and executable

### Environment Configuration
```bash
# On VPS
cd /opt/ai-career
cp .env.vps.template .env
nano .env
```

- [ ] `.env` file created from template
- [ ] `DOCKER_REGISTRY` set (must match build)
- [ ] `IMAGE_TAG` set (usually `latest`)
- [ ] `POSTGRES_PASSWORD` set (strong password)
- [ ] `JWT_ACCESS_SECRET` generated (`openssl rand -hex 32`)
- [ ] `JOBSPY_API_TOKEN` generated (`openssl rand -hex 16`)
- [ ] `WEB_URL` set to production domain
- [ ] `NEXT_PUBLIC_API_URL` set (must match build)
- [ ] `NEXT_PUBLIC_SITE_URL` set (must match build)
- [ ] All required variables configured
- [ ] `.env` file secured (`chmod 600 .env`)

### Registry Access
If using private registry:
```bash
# Docker Hub
docker login

# GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u username --password-stdin

# Private Registry
docker login registry.example.com
```

- [ ] Docker login successful
- [ ] Can pull images from registry

---

## ✅ Nginx Configuration (Optional but Recommended)

### Install Nginx
```bash
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx
```

- [ ] Nginx installed
- [ ] Certbot installed

### Configure Sites
```nginx
# /etc/nginx/sites-available/ai-career

# API Upstream
upstream api_backend {
    server localhost:4000;
}

# Web Upstream
upstream web_backend {
    server localhost:3000;
}

# HTTP -> HTTPS Redirect
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # API
    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Web
    location / {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] Nginx configuration created
- [ ] SSL certificate obtained (`certbot --nginx -d yourdomain.com`)
- [ ] Configuration tested (`nginx -t`)
- [ ] Nginx reloaded (`systemctl reload nginx`)

### Firewall
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

- [ ] Firewall configured
- [ ] Only necessary ports open
- [ ] SSH access maintained

---

## ✅ Deployment

### Initial Deployment
```bash
cd /opt/ai-career
chmod +x scripts/docker-deploy-vps.sh
./scripts/docker-deploy-vps.sh
```

- [ ] Deployment script runs successfully
- [ ] Images pulled from registry
- [ ] Containers started
- [ ] Database migrations run
- [ ] Health checks passing

### Verification
```bash
# Check services
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Test endpoints
curl -I https://yourdomain.com
curl https://yourdomain.com/api/health
```

- [ ] All services running
- [ ] No error logs
- [ ] Web accessible via domain
- [ ] API accessible via domain/api
- [ ] API docs accessible via domain/api/docs
- [ ] Health endpoints responding

---

## ✅ Post-Deployment

### Database
```bash
# Run seed (optional, for demo data)
docker compose -f docker-compose.prod.yml exec api pnpm exec prisma db seed
```

- [ ] Database schema migrated
- [ ] Demo data seeded (if desired)
- [ ] Database backups configured

### Monitoring
- [ ] Log monitoring setup
- [ ] Health check monitoring
- [ ] Disk space monitoring
- [ ] Resource usage monitoring

### Backups
```bash
# Database backup script
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres ai_career_platform > backup-$(date +%Y%m%d).sql
```

- [ ] Backup script created
- [ ] Backup cron job configured
- [ ] Backup restore tested

### Documentation
- [ ] Deployment credentials documented
- [ ] Recovery procedures documented
- [ ] Team access configured

---

## ✅ CI/CD (Optional)

### GitHub Actions
- [ ] GitHub Actions workflow committed
- [ ] GitHub Secrets configured:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_SITE_URL`
- [ ] Workflow runs successfully
- [ ] Images automatically pushed on commit

### Automated Deployment
- [ ] SSH key configured for automated access
- [ ] Deployment webhook or script configured
- [ ] Automated deployment tested

---

## 🎯 Final Checks

### Security
- [ ] All passwords strong and unique
- [ ] `.env` file not committed to git
- [ ] Firewall properly configured
- [ ] SSL certificate valid
- [ ] HTTPS enforced
- [ ] OAuth callbacks configured (if using)

### Performance
- [ ] Image sizes reasonable (~600MB total)
- [ ] Deployment time acceptable (3-5 minutes)
- [ ] Response times good
- [ ] No memory leaks

### Reliability
- [ ] Health checks passing
- [ ] Restart policies configured
- [ ] Logging working
- [ ] Backups automated

---

## 📋 Common Issues

### Build Issues
**Problem:** Docker build fails locally  
**Solution:** Check `NEXT_PUBLIC_*` variables are set before build

**Problem:** Platform mismatch warnings  
**Solution:** Add `--platform linux/amd64` to build command

### Push Issues
**Problem:** Unauthorized to push to registry  
**Solution:** Run `docker login` with correct credentials

**Problem:** Image too large to push  
**Solution:** Images are optimized, but check network speed

### VPS Issues
**Problem:** Cannot pull images  
**Solution:** Run `docker login` on VPS

**Problem:** Services won't start  
**Solution:** Check `.env` file has all required variables

**Problem:** Health checks failing  
**Solution:** Check logs with `docker compose logs service-name`

---

## 🚀 You're Ready!

Once all items are checked:

1. ✅ Images built and pushed
2. ✅ VPS configured
3. ✅ Nginx configured
4. ✅ Deployment successful
5. ✅ All checks passing

**Your application is live!** 🎉

---

## 📞 Support

If you encounter issues:

1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Review documentation: `DOCKER_DEPLOYMENT.md`
3. Verify environment: `docker compose -f docker-compose.prod.yml config`
4. Check this checklist again

**Remember:** Build locally, deploy anywhere!
