# Root Cause Analysis: Next.js Production API URL Bug

## Problem Statement

After successful Google OAuth, the browser requests:

```
https://careersuite.cc/api/auth/me         ❌ 404 Not Found
https://careersuite.cc/api/auth/refresh    ❌ 404 Not Found
```

Instead of the correct backend URLs:

```
https://api.careersuite.cc/api/auth/me     ✅ Works
https://api.careersuite.cc/api/auth/refresh ✅ Works
```

## Root Cause

**Two GitHub Actions workflows had incorrect hardcoded fallback values for `NEXT_PUBLIC_API_URL`:**

### 1. `.github/workflows/docker-build.yml` (Line 114)

**WRONG:**
```yaml
NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL || 'https://careersuite.cc/api' }}
```

**Should be:**
```yaml
NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL || 'https://api.careersuite.cc/api' }}
```

### 2. `.github/workflows/docker-simple.yml` (Line 43)

**WRONG:**
```yaml
--build-arg NEXT_PUBLIC_API_URL=https://careersuite.cc/api \
```

**Should be:**
```yaml
--build-arg NEXT_PUBLIC_API_URL=https://api.careersuite.cc/api \
```

## Why This Causes the Issue

1. **Build-time baking**: Next.js replaces `process.env.NEXT_PUBLIC_API_URL` at **build time**, not runtime
2. **Workflow builds the image**: GitHub Actions builds the Docker image with the wrong URL
3. **JavaScript bundle contains wrong URL**: The production bundle contains:
   ```javascript
   const API_BASE_URL = "https://careersuite.cc/api"; // WRONG - missing api. subdomain
   ```
4. **Browser makes wrong requests**: All API calls go to `careersuite.cc/api/*` instead of `api.careersuite.cc/api/*`
5. **404 errors**: The web server doesn't have an API backend, returns 404

## Evidence

### 1. Environment variable in container is correct

```bash
$ docker exec ai-career-web printenv | grep NEXT_PUBLIC_API_URL
NEXT_PUBLIC_API_URL=https://api.careersuite.cc/api
```

✅ Runtime environment is correct

### 2. But the built JavaScript uses wrong URL

The Next.js build process **already baked in** the wrong URL during the GitHub Actions build.

Setting the environment variable at runtime doesn't help because Next.js has already replaced all occurrences of `process.env.NEXT_PUBLIC_API_URL` with the literal string from build time.

### 3. Source code is correct

```typescript
// apps/web/src/lib/api-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
```

✅ Code correctly uses `process.env.NEXT_PUBLIC_API_URL`

### 4. Dockerfile is correct

```dockerfile
# apps/web/Dockerfile (lines 62-64)
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
```

✅ Dockerfile correctly accepts and uses build args

### 5. GitHub Actions workflows had wrong values

❌ Both workflows passed **wrong build args** to Docker

## Complete Fix

### File 1: `.github/workflows/docker-build.yml`

```diff
--- a/.github/workflows/docker-build.yml
+++ b/.github/workflows/docker-build.yml
@@ -111,7 +111,7 @@ jobs:
           cache-to: type=gha,mode=max
           platforms: linux/amd64
           build-args: |
-            NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL || 'https://careersuite.cc/api' }}
+            NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL || 'https://api.careersuite.cc/api' }}
             NEXT_PUBLIC_SITE_URL=${{ vars.NEXT_PUBLIC_SITE_URL || 'https://careersuite.cc' }}
 
   build-worker:
```

### File 2: `.github/workflows/docker-simple.yml`

```diff
--- a/.github/workflows/docker-simple.yml
+++ b/.github/workflows/docker-simple.yml
@@ -40,7 +40,7 @@ jobs:
           docker buildx build \
             --platform linux/amd64 \
             --file apps/web/Dockerfile \
-            --build-arg NEXT_PUBLIC_API_URL=https://careersuite.cc/api \
+            --build-arg NEXT_PUBLIC_API_URL=https://api.careersuite.cc/api \
             --build-arg NEXT_PUBLIC_SITE_URL=https://careersuite.cc \
             --tag ghcr.io/${{ steps.repo.outputs.repo }}-web:latest \
             --tag ghcr.io/${{ steps.repo.outputs.repo }}-web:${{ github.sha }} \
```

## Architecture Explanation

### Frontend Domain
```
https://careersuite.cc
```
- Serves the Next.js application
- Static assets, HTML, client-side JavaScript

### Backend Domain
```
https://api.careersuite.cc
```
- Serves the NestJS API
- All `/api/*` routes (auth, jobs, etc.)

### Correct API Calls
```javascript
// Browser makes requests to:
https://api.careersuite.cc/api/auth/me
https://api.careersuite.cc/api/auth/refresh
https://api.careersuite.cc/api/jobs
// etc.
```

### Why the Subdomain Matters

1. **Cloudflare DNS**: 
   - `careersuite.cc` → Web server (Next.js)
   - `api.careersuite.cc` → API server (NestJS)

2. **Separate services**: Web and API run in different containers

3. **CORS**: API must allow requests from `careersuite.cc` origin

4. **Cookie domain**: Refresh token cookie must be scoped correctly

## Verification After Fix

### 1. Trigger a new build

Push the fixed workflows to trigger GitHub Actions:

```bash
git add .github/workflows/docker-build.yml .github/workflows/docker-simple.yml
git commit -m "fix: correct NEXT_PUBLIC_API_URL in GitHub Actions workflows"
git push origin main
```

### 2. Wait for build to complete

GitHub Actions will build a new web image with the correct API URL baked in.

### 3. Deploy new image

```bash
# On production server
docker compose -f docker-compose.prod.yml pull web
docker compose -f docker-compose.prod.yml up -d --force-recreate web
```

### 4. Verify in browser

1. Open DevTools → Network tab
2. Visit `https://careersuite.cc/login`
3. Click "Sign in with Google"
4. Complete OAuth flow
5. **Check network requests**:
   - ✅ `GET https://api.careersuite.cc/api/auth/me` (200 OK)
   - ✅ `POST https://api.careersuite.cc/api/auth/refresh` (as needed)

6. **Verify successful login**: User redirected to dashboard, authenticated

### 5. Inspect built JavaScript (optional)

```bash
# Inside the web container
docker exec ai-career-web cat /app/.next/static/chunks/*.js | grep api.careersuite.cc
```

Should find references to `https://api.careersuite.cc/api`, not `https://careersuite.cc/api`.

## Which Workflow Runs?

Both workflows listen to `push` events on `main`:

- **`docker-build.yml`**: Full-featured, uses caching, metadata actions
- **`docker-simple.yml`**: Simple shell commands

If both run, **both had the bug**. Both needed fixing.

Check your GitHub Actions tab to see which workflow actually executed for your last push.

## Why Runtime Environment Variables Didn't Help

Common misconception: "Setting `NEXT_PUBLIC_API_URL` in the container will fix it."

**Wrong.** Next.js `NEXT_PUBLIC_*` variables are **build-time only**:

```typescript
// Source code:
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// After Next.js build (if built with NEXT_PUBLIC_API_URL=https://wrong.url/api):
const API_BASE_URL = "https://wrong.url/api";  // Literal string, no longer a variable
```

The environment variable reference is **compiled away**. Setting it at runtime has no effect.

You **must** rebuild the image with the correct build arg.

## Related Files (No Changes Needed)

These files were checked and are **already correct**:

### ✅ `apps/web/Dockerfile`
- Correctly accepts `ARG NEXT_PUBLIC_API_URL`
- Correctly sets `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL`

### ✅ `apps/web/src/lib/api-client.ts`
- Correctly uses `process.env.NEXT_PUBLIC_API_URL`
- Has sensible `localhost` fallback for development

### ✅ `apps/web/src/providers/auth-provider.tsx`
- Correctly uses `process.env.NEXT_PUBLIC_API_URL`

### ✅ `apps/web/src/app/(auth)/login/page.tsx`
- Correctly uses `process.env.NEXT_PUBLIC_API_URL`

### ✅ `apps/web/next.config.js`
- No problematic rewrites or proxies
- Empty `rewrites()` function returns `[]`

### ✅ `.env`, `.env.production`, `docker-compose.prod.yml`
- All have correct `NEXT_PUBLIC_API_URL=https://api.careersuite.cc/api`
- But these don't affect the **already-built** Docker image from GHCR

## Timeline of the Bug

1. ✅ Developer writes correct frontend code using `process.env.NEXT_PUBLIC_API_URL`
2. ✅ Developer sets correct value in local `.env` files
3. ❌ **GitHub Actions workflow has wrong default fallback URL**
4. ❌ GitHub Actions builds Docker image with **wrong URL baked in**
5. ✅ Docker image pushed to GHCR (but contains wrong URL)
6. ❌ Production server pulls image with wrong URL
7. ❌ Browser makes requests to `careersuite.cc/api/*` instead of `api.careersuite.cc/api/*`
8. ❌ 404 errors, authentication fails

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend code | ✅ Correct | Uses `process.env.NEXT_PUBLIC_API_URL` properly |
| Dockerfile | ✅ Correct | Accepts and uses build args properly |
| docker-compose | ✅ Correct | Passes correct env vars (but doesn't affect pre-built image) |
| `.env` files | ✅ Correct | Have correct URLs |
| **`docker-build.yml`** | ❌ **BUG** | **Wrong fallback URL** |
| **`docker-simple.yml`** | ❌ **BUG** | **Wrong hardcoded URL** |

**Fix**: Change workflow fallback/default URLs from `https://careersuite.cc/api` to `https://api.careersuite.cc/api`.

**Impact**: Next.js build will embed correct API URLs, browser will make requests to the right backend.
