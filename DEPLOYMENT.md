# Production Deployment Guide

Complete guide for deploying AI Career Platform on an Ubuntu VPS with Docker, Nginx, and SSL.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Deployment Steps](#detailed-deployment-steps)
- [Post-Deployment](#post-deployment)
- [Management](#management)
- [Monitoring](#monitoring)
- [Backup & Restore](#backup--restore)
- [Updates](#updates)
- [Troubleshooting](#troubleshooting)
- [Security Checklist](#security-checklist)

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 20.04 LTS or later (Debian-based)
- **RAM**: Minimum 2GB, recommended 4GB+
- **CPU**: Minimum 2 cores, recommended 4+
- **Storage**: Minimum 20GB, recommended 50GB+
- **Network**: Public IP address with ports 80, 443, 22 accessible

### Domain Configuration

Before deployment, configure DNS:

1. **Main domain** (e.g., `yourdomain.com`):
   - A record pointing to your VPS IP
   - CNAME record for `www` subdomain (optional)

2. **API subdomain** (e.g., `api.yourdomain.com`):
   - A record pointing to your VPS IP

Wait for DNS propagation (can take up to 24 hours, usually ~15 minutes).

Verify with:
```bash
dig yourdomain.com
dig api.yourdomain.com
```

### Access Requirements

- SSH access with root or sudo privileges
- Domain names configured
- Git installed (or ability to upload files)

## Quick Start

For an automated deployment on a fresh Ubuntu VPS:

```bash
# 1. SSH into your VPS
ssh root@your-vps-ip

# 2. Set environment variables
export DOMAIN="yourdomain.com"
export API_DOMAIN="api.yourdomain.com"
export EMAIL="admin@yourdomain.com"
export REPO_URL="https://github.com/yourusername/ai-career-platform.git"

# 3. Run deployment script
bash <(curl -s https://raw.githubusercontent.com/yourusername/ai-career-platform/main/scripts/deploy.sh)
```

This will:
- Install Docker and dependencies
- Configure firewall
- Clone repository
- Setup environment variables
- Build Docker images
- Configure Nginx
- Setup SSL certificates
- Start all services
- Run database migrations

**Estimated time**: 15-20 minutes

## Detailed Deployment Steps

### 1. Prepare the Server

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Git if not present
sudo apt-get install -y git curl wget

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 2. Clone Repository

```bash
# Create deployment directory
sudo mkdir -p /opt/ai-career-platform
cd /opt/ai-career-platform

# Clone repository
sudo git clone https://github.com/yourusername/ai-career-platform.git .
```

### 3. Configure Environment

```bash
# Copy environment template
sudo cp .env.production.example .env

# Generate secrets
JWT_SECRET=$(openssl rand -hex 64)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JOBSPY_TOKEN=$(openssl rand -hex 32)

# Edit .env file
sudo nano .env
```

**Required variables to set**:

```bash
# Generated secrets
JWT_ACCESS_SECRET=<generated-jwt-secret>
POSTGRES_PASSWORD=<generated-postgres-password>
JOBSPY_API_TOKEN=<generated-jobspy-token>

# Domain configuration
WEB_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api

# OAuth (if using Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
```

### 4. Build Docker Images

```bash
# Build all images
cd /opt/ai-career-platform
sudo docker compose -f docker-compose.prod.yml build

# This takes 10-15 minutes
```

### 5. Setup Nginx Reverse Proxy

```bash
# Set environment variables
export DOMAIN="yourdomain.com"
export API_DOMAIN="api.yourdomain.com"

# Run Nginx setup
cd nginx
sudo bash setup-nginx.sh
```

### 6. Start Services

```bash
# Start all containers
cd /opt/ai-career-platform
sudo docker compose -f docker-compose.prod.yml up -d

# Wait for services to start
sleep 30

# Check status
sudo docker compose -f docker-compose.prod.yml ps
```

### 7. Setup Database

```bash
# Run migrations
sudo docker compose -f docker-compose.prod.yml exec api pnpm --filter=@ai-career/api run prisma:migrate:deploy

# Seed demo data (optional)
sudo docker compose -f docker-compose.prod.yml exec api pnpm --filter=@ai-career/api run prisma:seed
```

### 8. Setup SSL Certificates

```bash
# Set environment variable
export EMAIL="admin@yourdomain.com"

# Run SSL setup
cd nginx
sudo bash setup-ssl.sh
```

This will:
- Install Certbot
- Obtain Let's Encrypt certificates
- Configure auto-renewal
- Reload Nginx with SSL

### 9. Verify Deployment

```bash
# Test HTTPS access
curl -I https://yourdomain.com
curl https://api.yourdomain.com/api/health

# Should return HTTP 200
```

Open in browser:
- Frontend: `https://yourdomain.com`
- API Docs: `https://api.yourdomain.com/api/docs`

## Post-Deployment

### 1. Setup Automated Backups and Monitoring

```bash
cd /opt/ai-career-platform/scripts
sudo bash setup-automation.sh
```

This configures:
- Daily database backups (2 AM)
- Health monitoring (every 5 minutes)
- Weekly Docker cleanup
- Log rotation

### 2. Change Demo User Passwords

Login and immediately change passwords for:
- `demo@aicareer.dev` / `Password123!`
- `admin@aicareer.dev` / `Password123!`

Or delete demo users:
```bash
# Access database
aicareer db

# Delete demo users
DELETE FROM users WHERE email IN ('demo@aicareer.dev', 'admin@aicareer.dev');
```

### 3. Create Admin User

```bash
# Via Swagger API docs
# Open: https://api.yourdomain.com/api/docs
# Use POST /auth/register endpoint
# Then manually update role in database

# Or via database
aicareer db
UPDATE users SET role = 'ADMIN' WHERE email = 'youremail@example.com';
```

### 4. Configure Email (Optional)

For production email notifications, add to `.env`:

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

Restart services:
```bash
aicareer restart
```

### 5. Setup External Monitoring

Consider adding external monitoring:
- **Uptime**: UptimeRobot, Pingdom, StatusCake
- **Performance**: New Relic, DataDog, Grafana
- **Logs**: Papertrail, Loggly, ELK Stack

## Management

### Using the `aicareer` Command

After running `setup-automation.sh`, you have a convenient management command:

```bash
# View status
aicareer status

# View logs
aicareer logs           # All services
aicareer logs api       # Specific service
aicareer logs -f web    # Follow logs

# Restart services
aicareer restart        # All services
aicareer restart api    # Specific service

# Stop/Start
aicareer stop
aicareer start

# Create backup
aicareer backup

# Run health checks
aicareer monitor

# Update application
aicareer update

# Shell access
aicareer shell api      # API container shell
aicareer shell worker   # Worker container shell

# Database access
aicareer db             # PostgreSQL CLI
aicareer redis          # Redis CLI
```

### Manual Docker Commands

```bash
cd /opt/ai-career-platform

# View containers
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f [service]

# Restart specific service
docker compose -f docker-compose.prod.yml restart api

# Scale workers
docker compose -f docker-compose.prod.yml up -d --scale worker=3

# Execute commands in container
docker compose -f docker-compose.prod.yml exec api sh

# View resource usage
docker stats
```

## Monitoring

### Health Checks

Manual health check:
```bash
aicareer monitor
```

Automated monitoring runs every 5 minutes via cron and checks:
- Docker daemon status
- Container health
- Disk space (alert at 80%, critical at 90%)
- Memory usage (alert at 85%, critical at 95%)
- API health endpoint
- Web frontend
- Database connectivity
- Redis connectivity
- SSL certificate expiry
- Recent errors in logs
- Nginx status

### View Monitoring Logs

```bash
# Monitoring logs
tail -f /var/log/ai-career-monitor.log

# Backup logs
tail -f /var/log/ai-career-backup.log

# Cleanup logs
tail -f /var/log/ai-career-cleanup.log

# Application logs
aicareer logs -f

# Nginx logs
tail -f /var/log/nginx/ai-career-*-access.log
tail -f /var/log/nginx/ai-career-*-error.log
```

### Metrics to Monitor

**System Level**:
- CPU usage: `htop` or `top`
- Memory: `free -h`
- Disk: `df -h`
- Network: `iftop` or `nethogs`

**Application Level**:
- Request rates (Nginx logs)
- Response times
- Error rates
- Queue depths (BullMQ via admin panel)
- Database connections
- Cache hit rates

**Docker Level**:
```bash
# Container stats
docker stats

# Disk usage
docker system df

# Image sizes
docker images
```

## Backup & Restore

### Create Backup

```bash
# Manual backup
aicareer backup

# Or with custom options
cd /opt/ai-career-platform
sudo bash scripts/backup.sh --output-dir /custom/path --keep-days 60
```

Backups include:
- PostgreSQL database (dump + SQL)
- Redis data
- Docker volumes
- Environment configuration
- Git state

Backups are stored in: `/var/backups/ai-career/`

### Automated Backups

Configured via `setup-automation.sh`:
- Runs daily at 2:00 AM
- Keeps last 30 days by default
- Compressed archives

### Restore from Backup

```bash
# List available backups
ls -lh /var/backups/ai-career/

# Use auto-generated restore script
sudo bash /var/backups/ai-career/restore_TIMESTAMP.sh backup_TIMESTAMP.tar.gz

# Or manual restore:
cd /opt/ai-career-platform

# 1. Stop services
docker compose -f docker-compose.prod.yml down

# 2. Extract backup
tar xzf /var/backups/ai-career/backup_TIMESTAMP.tar.gz

# 3. Restore environment
cp backup_TIMESTAMP/env.backup .env

# 4. Start database
docker compose -f docker-compose.prod.yml up -d postgres
sleep 10

# 5. Restore database
POSTGRES_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q postgres)
docker cp backup_TIMESTAMP/database.dump $POSTGRES_CONTAINER:/tmp/
docker exec $POSTGRES_CONTAINER pg_restore -U postgres -d ai_career_platform -c /tmp/database.dump

# 6. Start all services
docker compose -f docker-compose.prod.yml up -d
```

### Remote Backup Storage

Copy backups to remote location for disaster recovery:

```bash
# To S3
aws s3 sync /var/backups/ai-career/ s3://your-bucket/ai-career-backups/

# To another server via rsync
rsync -avz /var/backups/ai-career/ user@backup-server:/backups/ai-career/

# Schedule in cron
0 3 * * * aws s3 sync /var/backups/ai-career/ s3://your-bucket/ai-career-backups/ >> /var/log/remote-backup.log 2>&1
```

## Updates

### Update Application

```bash
# Standard update
aicareer update

# Or with options
cd /opt/ai-career-platform
sudo bash scripts/update.sh --branch main

# Skip rebuild (use existing images)
sudo bash scripts/update.sh --no-build

# Skip migrations
sudo bash scripts/update.sh --no-migrate

# Skip backup (not recommended)
sudo bash scripts/update.sh --no-backup
```

Update process:
1. Pre-flight checks
2. Create backup
3. Pull latest code
4. Build new images
5. Stop services gracefully
6. Run database migrations
7. Start updated services
8. Health checks
9. Cleanup old images

### Update System Packages

```bash
# Update OS packages
sudo apt-get update
sudo apt-get upgrade -y

# Update Docker
sudo apt-get install --only-upgrade docker-ce docker-ce-cli containerd.io
```

### Rollback

If an update fails:

```bash
# 1. Stop services
aicareer stop

# 2. Restore from backup
sudo bash /var/backups/ai-career/restore_LATEST.sh backup_LATEST.tar.gz

# 3. Check previous commit
cd /opt/ai-career-platform
git log --oneline -10

# 4. Checkout previous version
git checkout <previous-commit-hash>

# 5. Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
aicareer logs <service-name>

# Common issues:
# - Environment variable missing
# - Port conflict
# - Resource limits
# - Database migration failed

# Rebuild container
docker compose -f docker-compose.prod.yml up -d --force-recreate <service>
```

### 502 Bad Gateway

```bash
# Check if containers are running
aicareer status

# Check API health
curl http://localhost:4000/api/health

# Check Nginx logs
tail -f /var/log/nginx/ai-career-api-error.log

# Restart services
aicareer restart
```

### Database Connection Issues

```bash
# Check database container
docker compose -f docker-compose.prod.yml ps postgres

# Check database logs
aicareer logs postgres

# Test connection
aicareer db

# Verify DATABASE_URL in .env
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Check Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### High Memory Usage

```bash
# Check container memory
docker stats

# Restart heavy services
aicareer restart worker

# Adjust docker-compose resources
# Edit docker-compose.prod.yml and add:
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

### Disk Space Full

```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -af --volumes

# Check large files
du -sh /opt/ai-career-platform/*
du -sh /var/lib/docker/*

# Clean old logs
sudo journalctl --vacuum-time=3d

# Clean old backups
find /var/backups/ai-career/ -mtime +30 -delete
```

### Worker Not Processing Jobs

```bash
# Check worker logs
aicareer logs worker

# Check Redis connection
aicareer redis
PING

# Check queue in admin panel
# https://api.yourdomain.com/admin/queues

# Restart worker
aicareer restart worker
```

## Security Checklist

### Firewall

```bash
# Verify firewall rules
sudo ufw status

# Should only allow: 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

### SSH Security

```bash
# Disable password authentication (use keys only)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no

# Change default SSH port (optional)
# Port 2222

sudo systemctl restart sshd
```

### Environment Variables

- ✓ Strong JWT secret (64+ bytes hex)
- ✓ Strong database password
- ✓ Strong JobSpy token
- ✓ Never commit .env to Git
- ✓ Restrict .env file permissions: `chmod 600 .env`

### Docker Security

```bash
# Run containers as non-root (already configured in Dockerfiles)

# Limit container resources (add to docker-compose.prod.yml)
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G

# Keep Docker updated
sudo apt-get update && sudo apt-get upgrade docker-ce
```

### Database Security

- ✓ Database not exposed to internet (internal network only)
- ✓ Strong password
- ✓ Regular backups
- ✓ Connection pooling configured

### SSL/TLS

- ✓ Force HTTPS (already configured)
- ✓ HSTS enabled
- ✓ Auto-renewal configured
- ✓ A+ rating on SSL Labs

Test: https://www.ssllabs.com/ssltest/

### Application Security

- ✓ CORS configured for your domains only
- ✓ Rate limiting enabled
- ✓ Input validation
- ✓ SQL injection prevention (Prisma ORM)
- ✓ XSS prevention (React)
- ✓ CSRF protection

### Monitoring

- ✓ Health checks enabled
- ✓ Error alerting configured
- ✓ Log aggregation
- ✓ Failed login monitoring

### Updates

- ✓ Regular security updates
- ✓ Dependency updates
- ✓ Docker image updates

---

## Quick Reference

### Important Paths

```
/opt/ai-career-platform          # Application directory
/var/backups/ai-career           # Backups
/var/log/nginx/ai-career-*.log   # Nginx logs
/var/log/ai-career-*.log         # Application logs
/etc/nginx/sites-available/      # Nginx configs
/etc/letsencrypt/live/           # SSL certificates
```

### Important Commands

```bash
aicareer status       # Check status
aicareer logs         # View logs
aicareer restart      # Restart services
aicareer backup       # Create backup
aicareer monitor      # Health check
aicareer update       # Update app
```

### Emergency Contacts

- System Admin: [your-email]
- Hosting Provider: [provider-support]
- DNS Provider: [dns-support]

---

## Getting Help

- **Documentation**: `/opt/ai-career-platform/README.md`
- **Issues**: GitHub Issues
- **Logs**: `aicareer logs`
- **Monitoring**: `aicareer monitor`

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Domain**: _______________  
**Server IP**: _______________
