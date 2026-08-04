# Required Secrets & Environment Variables - Quick Reference

## 🔴 CRITICAL - Application Won't Start Without These

### 1. Google OAuth Credentials (REQUIRED)
The application now uses **Google OAuth only** for authentication. You MUST set these:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

**Where to get them**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)  
**Setup guide**: See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)

### 2. JWT Secret (REQUIRED)
```bash
JWT_ACCESS_SECRET=your-random-32-byte-hex-string
```

**Generate with**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. JobSpy API Token (REQUIRED for job scraping)
```bash
JOBSPY_API_TOKEN=your-random-32-byte-hex-string
```

**Generate with**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🟡 Important - Set for Production

### Database & Redis
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_career_platform?schema=public
REDIS_URL=redis://localhost:6379
```

### URLs
```bash
WEB_URL=http://localhost:3000                    # Frontend URL
NEXT_PUBLIC_API_URL=http://localhost:4000/api    # API URL (baked into web build)
NEXT_PUBLIC_SITE_URL=http://localhost:3000       # Public site URL (baked into web build)
```

**For production**: Change to your actual domains BEFORE building the web app

## 🟢 Optional - Can Use Defaults

### Queue Configuration
```bash
QUEUE_PREFIX=aicareer                  # Default: aicareer
RUN_WORKERS_IN_API=false              # Default: false
ENABLE_SCHEDULER=false                # Default: false (true for worker)
```

### Billing (Lemon Squeezy)
```bash
LEMON_SQUEEZY_API_KEY=
LEMON_SQUEEZY_STORE_ID=
LEMON_SQUEEZY_WEBHOOK_SECRET=
LEMON_SQUEEZY_VARIANT_ID_PRO=
LEMON_SQUEEZY_VARIANT_ID_PREMIUM=
```
Empty values are valid - billing will be disabled (503 responses)

## Environment-Specific Callback URLs

### Development (localhost)
```bash
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

### Production
```bash
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
```

**IMPORTANT**: This MUST match exactly with the authorized redirect URI in your Google Cloud Console OAuth settings.

## Quick Setup for Development

```bash
# 1. Copy example
cp .env.example .env

# 2. Generate secrets
echo "JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
echo "JOBSPY_API_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env

# 3. Get Google OAuth credentials from Google Cloud Console
# Add them to .env manually:
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...

# 4. Start services
docker compose up -d
```

## Quick Setup for Production

```bash
# 1. Create .env with generated secrets
cat > .env << 'EOF'
# Database
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Secrets
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JOBSPY_API_TOKEN=$(openssl rand -hex 32)

# Google OAuth (REPLACE WITH YOUR VALUES)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback

# URLs (REPLACE WITH YOUR DOMAINS)
WEB_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
EOF

# 2. Replace placeholders with actual values
nano .env

# 3. Deploy
docker compose -f docker-compose.prod.yml up -d
```

## GitHub Actions Variables

Set these in your repository: Settings → Secrets and variables → Actions → Variables

```
NEXT_PUBLIC_API_URL     = https://api.yourdomain.com/api
NEXT_PUBLIC_SITE_URL    = https://yourdomain.com
```

These are baked into the Next.js build by GitHub Actions.

## Troubleshooting

| Error | Solution |
|-------|----------|
| `Configuration key "GOOGLE_CLIENT_ID" does not exist` | Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` to `.env` |
| `redirect_uri_mismatch` | Make sure `GOOGLE_CALLBACK_URL` matches authorized redirect URI in Google Console |
| API won't start in Docker | Check all REQUIRED variables are set in `.env` file |
| OAuth works locally but not in production | Check production callback URL in both `.env` AND Google Console |
| Web app can't reach API | Check `NEXT_PUBLIC_API_URL` was set correctly BEFORE building the image |

## File Locations

- **Development**: `.env` in project root
- **Docker Compose**: Reads from `.env` file in same directory
- **GitHub Actions**: Uses repository Variables (not Secrets) for build-time values
- **Production server**: `.env` file next to `docker-compose.prod.yml`

## See Also

- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) - Detailed Google OAuth setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide for GitHub Actions images
- [README.md](./README.md) - General project documentation
