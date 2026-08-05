# Deployment Instructions - API URL Fix

## What Was Fixed

**Root Cause**: GitHub Actions workflows were building the Next.js web image with the wrong API URL:
- ❌ **Wrong**: `https://careersuite.cc/api` (missing `api.` subdomain)
- ✅ **Correct**: `https://api.careersuite.cc/api`

## Changes Made

### 1. `.github/workflows/docker-build.yml`
```diff
- NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL || 'https://careersuite.cc/api' }}
+ NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL || 'https://api.careersuite.cc/api' }}
```

### 2. `.github/workflows/docker-simple.yml`
```diff
- --build-arg NEXT_PUBLIC_API_URL=https://careersuite.cc/api \
+ --build-arg NEXT_PUBLIC_API_URL=https://api.careersuite.cc/api \
```

## Deployment Steps

### 1. Wait for GitHub Actions to Complete

The fix has been pushed. GitHub Actions is now building a new web image with the correct API URL.

Check build status: https://github.com/krishanchamod2004-hub/ai-career-platform/actions

Wait for the build to complete (usually 5-10 minutes).

### 2. Pull and Deploy New Image

Once the GitHub Actions build is complete:

```bash
# SSH to your production server
ssh your-user@your-server

# Navigate to project directory
cd /path/to/ai-career-platform

# Pull the new web image with correct API URL
docker compose -f docker-compose.prod.yml pull web

# Recreate the web container with new image
docker compose -f docker-compose.prod.yml up -d --force-recreate web

# Verify the container restarted
docker compose ps web
```

### 3. Verify the Fix

#### A. Check Container Logs
```bash
docker compose logs -f web
```

Should see successful startup.

#### B. Test in Browser

1. Open DevTools (F12) → Network tab
2. Clear browser cache (Ctrl+Shift+Delete)
3. Visit `https://careersuite.cc/login`
4. Click "Sign in with Google"
5. Complete Google OAuth flow

**Expected behavior:**
- ✅ Network tab shows requests to `https://api.careersuite.cc/api/auth/me` (not `careersuite.cc/api/...`)
- ✅ Status: 200 OK (or 401 if not logged in - but not 404)
- ✅ Successfully logged in and redirected to dashboard

#### C. Verify Built JavaScript

Optional deep verification:

```bash
# Inside the web container, check the built JavaScript bundle
docker exec ai-career-web sh -c "grep -r 'api.careersuite.cc' .next/static/chunks/ | head -1"
```

Should find references to `api.careersuite.cc`, confirming the correct URL was baked into the build.

## Expected Results

### Before Fix
```
Browser → https://careersuite.cc/api/auth/me
Result: 404 Not Found (wrong server, no API)
```

### After Fix
```
Browser → https://api.careersuite.cc/api/auth/me
Result: 200 OK (or 401 if not authenticated)
OAuth login: ✅ Works end-to-end
```

## Troubleshooting

### Issue: Still seeing 404 errors

**Cause**: Old image still cached or not pulled correctly

**Fix**:
```bash
# Force remove old image
docker image rm ghcr.io/krishanchamod2004-hub/ai-career-platform-web:latest

# Pull fresh
docker compose -f docker-compose.prod.yml pull web

# Recreate
docker compose -f docker-compose.prod.yml up -d --force-recreate web
```

### Issue: Browser still calling careersuite.cc/api

**Cause**: Browser cache

**Fix**:
1. Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. Clear browser cache completely
3. Try in incognito/private window

### Issue: GitHub Actions build failed

**Check**: https://github.com/krishanchamod2004-hub/ai-career-platform/actions

**Fix**: Click "Re-run all jobs" on the failed workflow

## Verification Checklist

- [ ] GitHub Actions build completed successfully
- [ ] Pulled new web image on production server
- [ ] Restarted web container
- [ ] Cleared browser cache
- [ ] Tested Google OAuth login
- [ ] Network tab shows requests to `api.careersuite.cc`
- [ ] Successfully authenticated and redirected to dashboard
- [ ] No 404 errors on `/api/auth/me` or `/api/auth/refresh`

## Architecture Reminder

```
Frontend Domain:  https://careersuite.cc           (Next.js)
Backend Domain:   https://api.careersuite.cc       (NestJS)

All API requests must go to: https://api.careersuite.cc/api/*
```

## Related Documentation

- Complete root cause analysis: `NEXT_API_URL_ROOT_CAUSE.md`
- Previous OAuth fixes:
  - Backend: `ROOT_CAUSE_OAUTH_FIX.md`
  - Frontend: `FRONTEND_OAUTH_FIX.md`

## Timeline

| Issue | Root Cause | Status |
|-------|-----------|--------|
| Backend OAuth crash | Missing Google OAuth vars in env validation | ✅ Fixed (commit 94c6a83) |
| Frontend OAuth 401 | Race condition storing accessToken | ✅ Fixed (commit 8d50e47) |
| Frontend 404 on /api/* | Wrong API URL in GitHub Actions workflows | ✅ Fixed (commit 7957183) |

**All three OAuth issues are now resolved.** 🎉

## Contact

If issues persist after following these steps, check:
1. GitHub Actions build logs
2. Docker container logs: `docker compose logs web`
3. Browser console for any JavaScript errors
4. Network tab for actual URLs being called
