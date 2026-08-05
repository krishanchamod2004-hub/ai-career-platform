# Production Environment Setup Guide

This guide walks you through setting up the production environment configuration for the AI Career Platform.

## Overview

The platform uses environment variables for configuration. For production deployments, you need to create a `.env` file on your server with all the required settings.

## Quick Start

1. **On your production server**, copy the template:
   ```bash
   cp .env.production.template .env
   ```

2. **Edit `.env`** and replace all placeholder values with your actual production credentials

3. **Start the application**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## Environment Variables Explained

### Database Configuration

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE
POSTGRES_DB=ai_career_platform
DATABASE_URL=postgresql://postgres:YOUR_SECURE_PASSWORD_HERE@postgres:5432/ai_career_platform?schema=public
```

- Use a strong password (20+ characters, mixed case, numbers, symbols)
- The `DATABASE_URL` must match the password in `POSTGRES_PASSWORD`
- Host is `postgres` when using Docker Compose (service name)

### Authentication & Security

```bash
JWT_ACCESS_SECRET=YOUR_JWT_SECRET_HERE
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_DAYS=30
```

**Generate a secure JWT secret:**
```bash
openssl rand -hex 32
```

Or using Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Google OAuth 2.0 (Required)

```bash
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
```

**Setup steps:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://api.yourdomain.com/api/auth/google/callback`
4. Copy Client ID and Client Secret

See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for detailed instructions.

### Public URLs

```bash
WEB_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

⚠️ **Important**: 
- These must match your actual domain names
- Use `https://` for production
- No trailing slashes
- `NEXT_PUBLIC_API_URL` is baked into the web app build, so set it as a GitHub Actions variable

### JobSpy Scraper

```bash
JOBSPY_API_TOKEN=YOUR_JOBSPY_TOKEN_HERE
JOBSPY_ALLOW_INSECURE=false
```

**Generate a secure token:**
```bash
openssl rand -hex 32
```

This token authenticates requests between the API and JobSpy service.

### Worker & Queue Configuration

These settings control job scraping and notification processing:

```bash
QUEUE_PREFIX=aicareer
SCRAPER_CONCURRENCY=2
NOTIFICATIONS_CONCURRENCY=5
SCRAPER_MAX_CONSECUTIVE_FAILURES=10
JOB_STALE_DAYS=14
LOG_RETENTION_DAYS=30
```

Default values are production-ready. Adjust based on your server resources:
- **SCRAPER_CONCURRENCY**: Increase if you have more CPU cores and want faster scraping
- **NOTIFICATIONS_CONCURRENCY**: Increase for faster email/notification delivery
- **JOB_STALE_DAYS**: Jobs not seen in this many days are marked as expired
- **LOG_RETENTION_DAYS**: Scraper logs older than this are pruned

### AI Configuration

```bash
AI_REQUEST_TIMEOUT_MS=60000
AI_MAX_OUTPUT_TOKENS=1200
AI_MAX_ATTEMPTS=2
```

These control AI job evaluations (users bring their own API keys):
- **AI_REQUEST_TIMEOUT_MS**: Max time to wait for LLM response (60 seconds)
- **AI_MAX_OUTPUT_TOKENS**: Token limit for evaluation responses
- **AI_MAX_ATTEMPTS**: Retry attempts on LLM failures

### Billing (Optional)

```bash
LEMON_SQUEEZY_API_KEY=
LEMON_SQUEEZY_STORE_ID=
LEMON_SQUEEZY_WEBHOOK_SECRET=
LEMON_SQUEEZY_VARIANT_ID_PRO=
LEMON_SQUEEZY_VARIANT_ID_PREMIUM=
```

Leave blank to run without billing integration. The app will work normally with manual plan assignments via admin dashboard.

To enable billing:
1. Create account at [Lemon Squeezy](https://www.lemonsqueezy.com/)
2. Get API key from Settings → API
3. Create webhook endpoint: `https://api.yourdomain.com/api/billing/webhook`
4. Get variant IDs from your products

### Cron Schedules

```bash
CRON_DAILY_DIGEST=0 8 * * *
CRON_WEEKLY_DIGEST=0 8 * * 1
CRON_EXPIRE_JOBS=0 2 * * *
CRON_DAILY_STATS=0 1 * * *
CRON_APPLICATION_REMINDERS=0 9 * * *
CRON_PRUNE_LOGS=0 3 * * 0
```

These are cron expressions in UTC time. Defaults are production-ready.

## Security Checklist

Before deploying to production:

- [ ] Generated strong, unique passwords for all services
- [ ] Used `openssl rand -hex 32` to generate secrets (not example values)
- [ ] Set up Google OAuth with correct redirect URIs
- [ ] Confirmed `.env` file is NOT committed to git
- [ ] Set correct production domains (https)
- [ ] Configured firewall to allow only necessary ports
- [ ] Set up SSL/TLS certificates (via Caddy or certbot)
- [ ] Backed up your `.env` file securely (encrypted password manager)

## Example Production .env

For reference, here's what your final `.env` should look like (with your real values):

```bash
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=xK9$mP2#vN8@qL5!wR7^zT4&hJ6*fG3
POSTGRES_DB=ai_career_platform
DATABASE_URL=postgresql://postgres:xK9$mP2#vN8@qL5!wR7^zT4&hJ6*fG3@postgres:5432/ai_career_platform?schema=public

# JWT
JWT_ACCESS_SECRET=2aab0b05322a4b8cfd61601a8d0cf866fc07066f2eb573a137249607bc4290a0
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_DAYS=30

# Google OAuth
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_CALLBACK_URL=https://api.careersuite.cc/api/auth/google/callback

# Public URLs
WEB_URL=https://careersuite.cc
NEXT_PUBLIC_API_URL=https://api.careersuite.cc/api
NEXT_PUBLIC_SITE_URL=https://careersuite.cc

# JobSpy
JOBSPY_API_TOKEN=367308603b1f9db8659fc5337b8595e412ee49f5b08308a8268167c8740d536b
JOBSPY_ALLOW_INSECURE=false

# (rest of the settings with defaults...)
```

## Troubleshooting

### API won't start

- **Check**: JWT_ACCESS_SECRET is set (required)
- **Check**: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
- **Check**: DATABASE_URL matches POSTGRES_PASSWORD
- **Check**: Docker logs: `docker compose logs api`

### OAuth redirect error

- **Check**: GOOGLE_CALLBACK_URL matches the authorized redirect URI in Google Console
- **Check**: URL uses `https://` in production
- **Check**: Domain DNS is correctly pointing to your server

### Jobs not scraping

- **Check**: JOBSPY_API_TOKEN matches between API and JobSpy service
- **Check**: JobSpy container is running: `docker compose ps jobspy`
- **Check**: Worker container is running: `docker compose ps worker`
- **Check**: Admin dashboard → Scraper status

### Database connection failed

- **Check**: Password in DATABASE_URL matches POSTGRES_PASSWORD
- **Check**: PostgreSQL container is running: `docker compose ps postgres`
- **Check**: Port 5432 is not blocked by firewall

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Complete VPS deployment walkthrough
- [Secrets Reference](./SECRETS.md) - Quick reference for all secrets
- [Google OAuth Setup](./GOOGLE_OAUTH_SETUP.md) - Detailed OAuth configuration
- [README](./README.md) - Project overview and local development

## Support

If you encounter issues:

1. Check Docker logs: `docker compose logs [service-name]`
2. Verify environment variables: `docker compose config`
3. Review the deployment guide for missing steps
4. Check that all required secrets are set
