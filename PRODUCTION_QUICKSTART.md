# Production VPS - Quick Start Guide

Ultra-concise guide for deploying AI Career Platform to production.

## 🚀 One-Line Deployment

```bash
bash <(curl -s https://raw.githubusercontent.com/yourusername/ai-career-platform/main/scripts/deploy.sh)
```

Set these environment variables first:
```bash
export DOMAIN="yourdomain.com"
export API_DOMAIN="api.yourdomain.com"
export EMAIL="admin@yourdomain.com"
export REPO_URL="https://github.com/yourusername/ai-career-platform.git"
```

## 📋 Prerequisites

- Ubuntu 20.04+ VPS with 2GB+ RAM
- Domain with A records pointing to VPS IP:
  - `yourdomain.com` → VPS IP
  - `api.yourdomain.com` → VPS IP
- Root/sudo access

## ⚡ Manual Quick Deploy

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Clone repo
git clone https://github.com/yourusername/ai-career-platform.git /opt/ai-career-platform
cd /opt/ai-career-platform

# 3. Configure environment
cp .env.production.example .env
nano .env  # Set JWT_ACCESS_SECRET, POSTGRES_PASSWORD, JOBSPY_API_TOKEN, domains

# 4. Build and start
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 5. Setup Nginx + SSL
cd nginx && bash setup-nginx.sh && bash setup-ssl.sh

# 6. Setup monitoring
cd ../scripts && bash setup-automation.sh
```

## 🎯 Essential Commands

```bash
aicareer status       # Container status
aicareer logs         # View all logs
aicareer logs api     # View API logs
aicareer restart      # Restart all services
aicareer backup       # Create backup
aicareer monitor      # Health check
aicareer update       # Update application
aicareer shell api    # Shell into API container
aicareer db           # PostgreSQL CLI
```

## 🔍 Verify Deployment

```bash
# Check containers
docker ps

# Test endpoints
curl https://yourdomain.com
curl https://api.yourdomain.com/api/health

# View logs
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml logs -f
```

## ⚙️ Required Environment Variables

Minimum required in `.env`:

```bash
# Secrets (generate with: openssl rand -hex 64)
JWT_ACCESS_SECRET=<64-char-hex>
POSTGRES_PASSWORD=<strong-password>
JOBSPY_API_TOKEN=<32-char-hex>

# Domains
WEB_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
```

## 🔧 Common Tasks

### Update Application
```bash
cd /opt/ai-career-platform
sudo bash scripts/update.sh
```

### Backup Database
```bash
sudo bash /opt/ai-career-platform/scripts/backup.sh
```

### View Logs
```bash
# All services
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml logs -f

# Specific service
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml logs -f api

# Nginx logs
tail -f /var/log/nginx/ai-career-*-error.log
```

### Restart Services
```bash
cd /opt/ai-career-platform
docker compose -f docker-compose.prod.yml restart
```

### Scale Workers
```bash
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml up -d --scale worker=3
```

## 🚨 Troubleshooting

### 502 Bad Gateway
```bash
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml ps
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml restart
```

### Container Won't Start
```bash
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml logs <service>
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml up -d --force-recreate <service>
```

### SSL Issues
```bash
sudo certbot certificates
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Out of Disk Space
```bash
docker system prune -af --volumes
find /var/backups/ai-career/ -mtime +30 -delete
```

## 📊 Monitoring

### Health Check
```bash
bash /opt/ai-career-platform/scripts/monitor.sh
```

### Resource Usage
```bash
docker stats
df -h
free -h
```

### Logs Location
```
/var/log/nginx/ai-career-*-access.log    # Nginx access
/var/log/nginx/ai-career-*-error.log     # Nginx errors
/var/log/ai-career-backup.log             # Backups
/var/log/ai-career-monitor.log            # Monitoring
```

## 🔐 Security Checklist

- [ ] Strong passwords generated
- [ ] Firewall configured (ports 22, 80, 443 only)
- [ ] SSH key authentication enabled
- [ ] SSL certificates installed
- [ ] Demo user passwords changed
- [ ] Automated backups configured
- [ ] Monitoring enabled
- [ ] `.env` file permissions: `chmod 600 .env`

## 📚 Full Documentation

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete guide.

## 🆘 Emergency Recovery

```bash
# 1. Stop services
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml down

# 2. List backups
ls -lh /var/backups/ai-career/

# 3. Restore
sudo bash /var/backups/ai-career/restore_<TIMESTAMP>.sh /var/backups/ai-career/backup_<TIMESTAMP>.tar.gz

# 4. Start services
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml up -d
```

## 🔗 Important URLs

- Frontend: `https://yourdomain.com`
- API: `https://api.yourdomain.com/api`
- API Docs: `https://api.yourdomain.com/api/docs`
- Health: `https://api.yourdomain.com/api/health`

## 👥 Demo Users

After seeding database:
- Regular: `demo@aicareer.dev` / `Password123!`
- Admin: `admin@aicareer.dev` / `Password123!`

**⚠️ Change these passwords immediately in production!**

---

**Need help?** See [DEPLOYMENT.md](DEPLOYMENT.md) or check logs with `aicareer logs`
