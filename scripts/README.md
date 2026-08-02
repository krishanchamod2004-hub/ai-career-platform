# Production Scripts

This directory contains automation scripts for deploying and managing the AI Career Platform in production.

## Scripts Overview

### 🚀 Deployment

#### `deploy.sh`
Initial VPS deployment automation.

```bash
# Full automated deployment
export DOMAIN="yourdomain.com"
export API_DOMAIN="api.yourdomain.com"
export EMAIL="admin@yourdomain.com"
sudo bash deploy.sh
```

**What it does:**
- Installs Docker and dependencies
- Configures firewall
- Clones repository
- Generates secure secrets
- Builds Docker images
- Sets up Nginx reverse proxy
- Obtains SSL certificates
- Starts all services
- Runs database migrations
- Seeds demo data

**Prerequisites:**
- Fresh Ubuntu 20.04+ VPS
- Root/sudo access
- Domain DNS configured

---

### 🔄 Updates

#### `update.sh`
Safe production updates with automatic rollback on failure.

```bash
# Standard update
sudo bash update.sh

# With options
sudo bash update.sh --branch main --no-backup  # Skip backup (not recommended)
sudo bash update.sh --no-build                 # Skip image rebuild
sudo bash update.sh --no-migrate               # Skip migrations
```

**What it does:**
- Pre-flight checks (disk space, running containers)
- Creates backup
- Pulls latest code
- Builds new images
- Stops services gracefully
- Runs migrations
- Starts updated services
- Health checks
- Cleanup

**Rollback:** Automatic on migration failure, manual restore from backup otherwise.

---

### 💾 Backup & Restore

#### `backup.sh`
Comprehensive backup of all data and configuration.

```bash
# Standard backup
sudo bash backup.sh

# With options
sudo bash backup.sh --output-dir /custom/path  # Custom backup location
sudo bash backup.sh --keep-days 60             # Retention period
sudo bash backup.sh --no-compress              # Skip compression
```

**What it backs up:**
- PostgreSQL database (dump + SQL)
- Redis data
- Docker volumes
- Environment configuration
- Nginx configuration
- Git state (commit, changes, diff)

**Backup location:** `/var/backups/ai-career/backup_TIMESTAMP.tar.gz`

**Restore:**
```bash
# Use auto-generated restore script
sudo bash /var/backups/ai-career/restore_TIMESTAMP.sh backup_TIMESTAMP.tar.gz

# Or manual restore (see DEPLOYMENT.md)
```

---

### 📊 Monitoring

#### `monitor.sh`
Health checks for all services with alerting.

```bash
# Manual check
sudo bash monitor.sh

# With alerts
sudo bash monitor.sh --alert-email admin@example.com
sudo bash monitor.sh --slack-webhook https://hooks.slack.com/services/...

# Quiet mode (only errors)
sudo bash monitor.sh --quiet
```

**What it checks:**
- Docker daemon status
- Container status and health
- Disk space (warning at 80%, critical at 90%)
- Memory usage (warning at 85%, critical at 95%)
- API health endpoint
- Web frontend
- Database connectivity
- Redis connectivity
- SSL certificate expiry
- Recent errors in logs
- Nginx status

**Exit codes:**
- `0` - All checks passed
- `1` - Errors detected

**Automated:** Runs every 5 minutes via cron (after running `setup-automation.sh`)

---

### ⚙️ Automation

#### `setup-automation.sh`
Configures automated tasks and creates management commands.

```bash
sudo bash setup-automation.sh
```

**What it sets up:**

**Cron jobs:**
- Daily backup at 2:00 AM
- Health monitoring every 5 minutes
- Weekly Docker cleanup (Sunday 3:00 AM)
- Log rotation

**Management command:**
Creates `aicareer` command for easy management:

```bash
aicareer status       # Container status
aicareer logs         # View logs
aicareer restart      # Restart services
aicareer backup       # Create backup
aicareer monitor      # Health check
aicareer update       # Update app
aicareer shell api    # Shell into container
aicareer db           # PostgreSQL CLI
aicareer redis        # Redis CLI
```

**Log files:**
- `/var/log/ai-career-backup.log`
- `/var/log/ai-career-monitor.log`
- `/var/log/ai-career-cleanup.log`

---

## Usage Examples

### Initial Deployment

```bash
# 1. Clone repository
git clone <repo-url> /opt/ai-career-platform
cd /opt/ai-career-platform

# 2. Configure environment
export DOMAIN="yourdomain.com"
export API_DOMAIN="api.yourdomain.com"
export EMAIL="admin@yourdomain.com"

# 3. Run deployment
cd scripts
sudo bash deploy.sh
```

### Daily Operations

```bash
# Check status
aicareer status

# View logs
aicareer logs -f

# Restart service
aicareer restart api

# Create backup
aicareer backup

# Run health check
aicareer monitor
```

### Weekly Updates

```bash
# Update application
aicareer update

# Or manually
cd /opt/ai-career-platform/scripts
sudo bash update.sh
```

### Emergency Recovery

```bash
# 1. List backups
ls -lh /var/backups/ai-career/

# 2. Stop services
aicareer stop

# 3. Restore
sudo bash /var/backups/ai-career/restore_TIMESTAMP.sh backup_TIMESTAMP.tar.gz

# 4. Start services
aicareer start
```

---

## Script Requirements

All scripts require:
- Root/sudo access
- Working directory: `/opt/ai-career-platform`
- Docker installed and running
- `.env` file configured

## Environment Variables

Scripts respect these environment variables:

```bash
# Deployment
DOMAIN=yourdomain.com
API_DOMAIN=api.yourdomain.com
EMAIL=admin@yourdomain.com
REPO_URL=https://github.com/user/repo.git
DEPLOY_DIR=/opt/ai-career-platform

# Backup
BACKUP_DIR=/var/backups/ai-career
KEEP_DAYS=30

# Monitoring
ALERT_EMAIL=admin@example.com
SLACK_WEBHOOK=https://hooks.slack.com/...
```

## Script Output

All scripts provide colored output:
- 🟢 **Green** - Success/Info
- 🟡 **Yellow** - Warning
- 🔴 **Red** - Error

## Logs

Script logs are stored in:
```
/var/log/ai-career-backup.log     # Backup operations
/var/log/ai-career-monitor.log    # Health checks
/var/log/ai-career-cleanup.log    # Docker cleanup
```

View logs:
```bash
tail -f /var/log/ai-career-*.log
```

## Cron Schedule

After running `setup-automation.sh`:

```bash
# View cron jobs
crontab -l

# Edit cron jobs
crontab -e
```

Default schedule:
- `0 2 * * *` - Daily backup (2:00 AM)
- `*/5 * * * *` - Health monitoring (every 5 minutes)
- `0 3 * * 0` - Docker cleanup (Sunday 3:00 AM)
- `0 1 * * *` - Log rotation (1:00 AM)

## Troubleshooting

### Script won't run
```bash
# Make executable
chmod +x scripts/*.sh

# Check shebang
head -1 scripts/deploy.sh  # Should be #!/bin/bash
```

### Permission denied
```bash
# Run with sudo
sudo bash scripts/deploy.sh

# Or as root
su -
bash scripts/deploy.sh
```

### Environment variables not set
```bash
# Export before running
export DOMAIN="yourdomain.com"
export API_DOMAIN="api.yourdomain.com"
sudo -E bash scripts/deploy.sh  # -E preserves environment
```

### Backup fails
```bash
# Check disk space
df -h

# Check permissions
ls -la /var/backups/

# Create backup directory
sudo mkdir -p /var/backups/ai-career
```

### Monitoring alerts not sending
```bash
# Check email configuration
which mail
sudo apt-get install mailutils

# Test email
echo "Test" | mail -s "Test" admin@example.com

# Check cron logs
grep CRON /var/log/syslog
```

## Safety Features

### Backup Before Changes
- `update.sh` creates automatic backup before updating
- Can be skipped with `--no-backup` (not recommended)

### Health Checks
- `update.sh` runs health checks after update
- Fails if health checks don't pass

### Graceful Shutdown
- Services stopped with 30-second grace period
- Allows in-flight requests to complete

### Rollback Support
- Backup includes restore script
- Git state preserved for rollback

### Error Handling
- All scripts use `set -e` (exit on error)
- Comprehensive error messages
- Exit codes for automation

## Best Practices

1. **Always backup before major changes**
   ```bash
   aicareer backup
   ```

2. **Test updates on staging first**
   ```bash
   # Create staging environment
   export DEPLOY_DIR=/opt/ai-career-staging
   bash scripts/deploy.sh
   ```

3. **Monitor after changes**
   ```bash
   aicareer monitor
   aicareer logs -f
   ```

4. **Keep backups offsite**
   ```bash
   # Sync to S3
   aws s3 sync /var/backups/ai-career/ s3://bucket/backups/
   ```

5. **Review logs regularly**
   ```bash
   tail -100 /var/log/ai-career-*.log
   ```

6. **Test restore procedure**
   ```bash
   # On staging
   bash /var/backups/ai-career/restore_TIMESTAMP.sh backup_TIMESTAMP.tar.gz
   ```

## Advanced Usage

### Custom Backup Schedule
```bash
# Edit crontab
crontab -e

# Change backup time to 3 AM
0 3 * * * cd /opt/ai-career-platform && bash scripts/backup.sh
```

### Remote Monitoring
```bash
# Setup Slack alerts
export SLACK_WEBHOOK="https://hooks.slack.com/..."
bash setup-automation.sh

# Setup email alerts
export ALERT_EMAIL="admin@example.com"
bash setup-automation.sh
```

### Multiple Environments
```bash
# Production
DEPLOY_DIR=/opt/ai-career-production DOMAIN=app.example.com bash deploy.sh

# Staging
DEPLOY_DIR=/opt/ai-career-staging DOMAIN=staging.app.example.com bash deploy.sh
```

---

## Quick Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `deploy.sh` | Initial deployment | Once, on fresh VPS |
| `update.sh` | Update application | Weekly/as needed |
| `backup.sh` | Create backup | Daily (automated) |
| `monitor.sh` | Health checks | Every 5min (automated) |
| `setup-automation.sh` | Setup cron jobs | Once, after deploy |

## See Also

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Complete deployment guide
- [PRODUCTION_QUICKSTART.md](../PRODUCTION_QUICKSTART.md) - Quick start
- [nginx/README.md](../nginx/README.md) - Nginx configuration

---

**Need Help?**
- Check logs: `aicareer logs`
- Run health check: `aicareer monitor`
- Review: [DEPLOYMENT.md](../DEPLOYMENT.md)
