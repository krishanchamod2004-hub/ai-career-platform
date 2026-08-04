# Deployment Guide - Using GitHub Actions Built Images

This guide explains how to deploy the Docker images built by GitHub Actions to your server.

## Overview

GitHub Actions automatically builds and pushes Docker images to GitHub Container Registry (ghcr.io) when you push to the `main` or `master` branch. The images are:

- `ghcr.io/<your-username>/<repo-name>-api:latest` - API server
- `ghcr.io/<your-username>/<repo-name>-web:latest` - Frontend
- `ghcr.io/<your-username>/<repo-name>-worker:latest` - Background worker

## Prerequisites

1. **Google OAuth Credentials** - See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)
2. **GitHub Container Registry Access** - Create a Personal Access Token (PAT)
3. **Server Requirements** - Docker & Docker Compose installed

## Step 1: Set Up GitHub Container Registry Access

On your deployment server:

```bash
# Create a GitHub Personal Access Token with read:packages scope
# Go to: https://github.com/settings/tokens

# Login to GitHub Container Registry
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## Step 2: Create Production docker-compose.yml

Create a `docker-compose.prod.yml` file on your server:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ai_career_platform
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - app-network

  jobspy:
    image: ghcr.io/<your-username>/<repo-name>-jobspy:latest
    restart: unless-stopped
    environment:
      JOBSPY_API_TOKEN: ${JOBSPY_API_TOKEN}
    networks:
      - app-network

  api:
    image: ghcr.io/<your-username>/<repo-name>-api:latest
    restart: unless-stopped
    depends_on:
      - postgres
      - redis
      - jobspy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/ai_career_platform?schema=public
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      # Google OAuth - REQUIRED
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_CALLBACK_URL: ${GOOGLE_CALLBACK_URL}
      # URLs
      WEB_URL: ${WEB_URL}
      # JobSpy
      JOBSPY_SERVICE_URL: http://jobspy:8000
      JOBSPY_API_TOKEN: ${JOBSPY_API_TOKEN}
      # Queue settings
      QUEUE_PREFIX: aicareer
      RUN_WORKERS_IN_API: 'false'
      ENABLE_SCHEDULER: 'false'
    ports:
      - "127.0.0.1:4000:4000"
    networks:
      - app-network

  worker:
    image: ghcr.io/<your-username>/<repo-name>-worker:latest
    restart: unless-stopped
    depends_on:
      - postgres
      - redis
      - jobspy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/ai_career_platform?schema=public
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      # Google OAuth
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_CALLBACK_URL: ${GOOGLE_CALLBACK_URL}
      WEB_URL: ${WEB_URL}
      # JobSpy
      JOBSPY_SERVICE_URL: http://jobspy:8000
      JOBSPY_API_TOKEN: ${JOBSPY_API_TOKEN}
      # Worker settings
      QUEUE_PREFIX: aicareer
      ENABLE_SCHEDULER: 'true'
      SCRAPER_CONCURRENCY: 2
      NOTIFICATIONS_CONCURRENCY: 5
    entrypoint: ['node', 'dist/worker.js']
    networks:
      - app-network

  web:
    image: ghcr.io/<your-username>/<repo-name>-web:latest
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NODE_ENV: production
      # These are baked into the build, so make sure GitHub Actions vars are set correctly
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL}
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

## Step 3: Create .env File on Server

Create a `.env` file with your production secrets:

```bash
# Generate secrets
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JOBSPY_API_TOKEN=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Create .env file
cat > .env << EOF
# Database
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# JWT
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}

# Google OAuth (GET FROM GOOGLE CLOUD CONSOLE)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback

# URLs
WEB_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# JobSpy
JOBSPY_API_TOKEN=${JOBSPY_API_TOKEN}
EOF
```

**IMPORTANT**: Replace the Google OAuth values with your actual credentials from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

## Step 4: Configure Google OAuth for Production

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add production authorized redirect URI:
   ```
   https://api.yourdomain.com/api/auth/google/callback
   ```
4. Make sure the credentials match what's in your `.env` file

## Step 5: Set Up GitHub Repository Variables

For the web app to have correct API URLs baked in during build:

1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add **Variables** (not secrets):
   - `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com/api`
   - `NEXT_PUBLIC_SITE_URL` = `https://yourdomain.com`

These are used in `.github/workflows/docker-build.yml`:
```yaml
build-args: |
  NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL || 'https://careersuite.cc/api' }}
  NEXT_PUBLIC_SITE_URL=${{ vars.NEXT_PUBLIC_SITE_URL || 'https://careersuite.cc' }}
```

## Step 6: Deploy

```bash
# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f api

# Run migrations (first time only)
docker compose -f docker-compose.prod.yml exec api pnpm prisma:migrate:deploy

# Seed demo data (optional)
docker compose -f docker-compose.prod.yml exec api pnpm prisma:seed
```

## Step 7: Set Up Reverse Proxy (Nginx/Caddy)

Use Caddy (recommended) or Nginx to handle HTTPS:

### Caddy (Automatic HTTPS)

```caddyfile
# /etc/caddy/Caddyfile

yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:4000
}
```

```bash
sudo systemctl restart caddy
```

### Nginx + Certbot

```nginx
# /etc/nginx/sites-available/ai-career

server {
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ai-career /etc/nginx/sites-enabled/
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
sudo systemctl restart nginx
```

## Updating the Application

When you push to main/master, GitHub Actions automatically builds new images:

```bash
# On your server, pull and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Check if migrations are needed
docker compose -f docker-compose.prod.yml exec api pnpm prisma:migrate:deploy
```

## Troubleshooting

### "Configuration key GOOGLE_CLIENT_ID does not exist"
- Check `.env` file has `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- Restart containers: `docker compose -f docker-compose.prod.yml restart api worker`

### "redirect_uri_mismatch" error
- Make sure `GOOGLE_CALLBACK_URL` in `.env` matches authorized redirect URI in Google Console
- Common issue: http vs https, or missing/extra trailing slash

### Cannot pull images from ghcr.io
- Make sure you're logged in: `docker login ghcr.io`
- Check image exists: `docker pull ghcr.io/<your-username>/<repo-name>-api:latest`
- Images are public by default; make them public in GitHub package settings if needed

### Web app shows wrong API URL
- Check GitHub Actions variables are set correctly
- Rebuild the web image with correct `NEXT_PUBLIC_API_URL`
- This is baked in at build time, not runtime

## Security Checklist

- [ ] Google OAuth credentials are in `.env` (not committed to git)
- [ ] Different OAuth credentials for dev/staging/prod
- [ ] HTTPS enabled via Caddy or Nginx + Certbot
- [ ] Firewall configured (only 80/443 open to public)
- [ ] Strong random secrets for JWT and database password
- [ ] Regular backups of postgres_data volume
- [ ] Container images are pulled from trusted registry (ghcr.io)

## Monitoring

Check application health:

```bash
# API health
curl https://api.yourdomain.com/api/health

# Check logs
docker compose -f docker-compose.prod.yml logs -f --tail=100 api
docker compose -f docker-compose.prod.yml logs -f --tail=100 worker

# Check containers
docker compose -f docker-compose.prod.yml ps
```
