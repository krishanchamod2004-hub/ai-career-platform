# Root Cause Analysis: Google OAuth Startup Failure

## Executive Summary

**Root Cause**: Environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` were excluded from the validated configuration object by class-transformer during NestJS ConfigModule initialization.

**Impact**: GoogleStrategy constructor received `undefined` values when calling `config.getOrThrow()`, causing Passport to throw "OAuth2Strategy requires a clientID option".

**Fix**: Added the three Google OAuth variables to the `EnvironmentVariables` class in `apps/api/src/config/env.validation.ts`.

---

## Root Cause Explanation

### The Problem Chain

1. **Container has the variables**: `docker exec` confirms `GOOGLE_CLIENT_ID` exists in `process.env` ✅
2. **Node.js can read them**: `process.env.GOOGLE_CLIENT_ID` works in isolation ✅  
3. **BUT ConfigService cannot read them**: `config.getOrThrow('GOOGLE_CLIENT_ID')` returns `undefined` ❌

### Why This Happens

The app uses `ConfigModule.forRoot()` with **custom validation**:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validate: validateEnv,
})
```

The `validateEnv` function uses `class-transformer`'s `plainToInstance`:

```typescript
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  // ...
}
```

**Critical behavior**: `plainToInstance()` only includes properties that **exist on the target class**.

Before the fix, `EnvironmentVariables` class looked like:

```typescript
class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  WEB_URL!: string;

  // ❌ GOOGLE_CLIENT_ID - NOT DECLARED
  // ❌ GOOGLE_CLIENT_SECRET - NOT DECLARED
  // ❌ GOOGLE_CALLBACK_URL - NOT DECLARED
}
```

**What happens during startup:**

1. NestJS reads all environment variables into a raw object: `{ GOOGLE_CLIENT_ID: "...", DATABASE_URL: "...", ... }`
2. `validateEnv()` is called with this raw object
3. `plainToInstance()` transforms the object, **but only includes properties declared in the class**
4. The validated config returned is: `{ DATABASE_URL: "...", JWT_ACCESS_SECRET: "...", WEB_URL: "..." }` — **Google OAuth keys are gone**
5. ConfigService uses this validated object as its source
6. `config.getOrThrow('GOOGLE_CLIENT_ID')` looks in the validated object, finds nothing, throws or returns `undefined`
7. GoogleStrategy's `super()` receives `undefined` for `clientID`
8. Passport throws: "OAuth2Strategy requires a clientID option"

---

## Why Diagnosis Was Difficult

1. **The container has the variables** — misleading because `process.env` still contains them
2. **Node.js can read them directly** — works because `process.env.GOOGLE_CLIENT_ID` bypasses ConfigService
3. **Docker Compose passes them correctly** — the variables reach the container fine
4. **GoogleStrategy code looks correct** — `config.getOrThrow()` is the right API
5. **The compiled JavaScript is correct** — no build issue
6. **The Docker image is up to date** — no caching issue

The **actual bug** was silent: class-transformer excluded undeclared properties without warning.

---

## The Fix

### File Changed

**`apps/api/src/config/env.validation.ts`**

### Exact Changes

Added three required properties to the `EnvironmentVariables` class:

```typescript
class EnvironmentVariables {
  // ... existing fields ...

  @IsString()
  GOOGLE_CLIENT_ID!: string;

  @IsString()
  GOOGLE_CLIENT_SECRET!: string;

  @IsString()
  GOOGLE_CALLBACK_URL!: string;

  // ... rest of fields ...
}
```

### Why This Fixes It

1. `plainToInstance()` now **includes** these properties during transformation
2. The validated config object contains `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`
3. `config.getOrThrow('GOOGLE_CLIENT_ID')` finds the value in the validated config
4. GoogleStrategy receives the correct values
5. Passport initializes successfully

---

## Verification

Run the test script to confirm the fix:

```bash
cd apps/api
npx tsx test-env-validation.ts
```

Expected output:
```
✅ Validation passed!

Validated config includes:
- GOOGLE_CLIENT_ID: test-client-id
- GOOGLE_CLIENT_SECRET: test-client-secret
- GOOGLE_CALLBACK_URL: http://localhost:4000/api/auth/google/callback

✅ ROOT CAUSE FIXED: Google OAuth variables are now included in validated config
```

---

## Additional Fix: JobSpy Variables

While fixing this, I discovered **JobSpy environment variables** also missing from validation:

- `JOBSPY_SERVICE_URL`
- `JOBSPY_API_TOKEN`  
- `JOBSPY_TIMEOUT_MS`

These are now added as **optional** fields (with defaults in the code), preventing future issues with the job scraping system.

---

## Deployment Instructions

### 1. Rebuild the Docker Image

The fix is in application code, so you must rebuild:

```bash
# Local build
docker compose build api

# Or pull from GitHub Actions (after pushing this fix)
git add apps/api/src/config/env.validation.ts
git commit -m "fix: add Google OAuth and JobSpy vars to env validation"
git push origin main

# Wait for GitHub Actions to build, then:
docker compose -f docker-compose.prod.yml pull api
```

### 2. Restart the Containers

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate api
```

### 3. Verify

```bash
# Check API logs
docker compose logs -f api

# Should see successful startup, no "OAuth2Strategy requires a clientID option"

# Test OAuth flow
curl https://api.careersuite.cc/api/auth/google
# Should redirect to Google (not error)
```

---

## Prevention

### Rule for Future Environment Variables

**Every environment variable read by ConfigService MUST be declared in `EnvironmentVariables` class.**

If you add a new `config.get()` or `config.getOrThrow()` call:

1. Add the property to `apps/api/src/config/env.validation.ts`
2. Mark it `@IsString()`, `@IsInt()`, etc. based on type
3. Mark it `@IsOptional()` if it has a default value
4. Use `!` suffix for required fields: `GOOGLE_CLIENT_ID!: string;`
5. Use `?` suffix for optional fields: `JOBSPY_API_TOKEN?: string;`

### Why class-transformer Works This Way

From the [class-transformer docs](https://github.com/typestack/class-transformer#working-with-nested-objects):

> "By default, `plainToInstance` will only transform properties that are decorated on the target class."

This is **intentional** — it prevents accidental inclusion of untrusted properties. But it requires discipline: declare every variable you intend to use.

---

## Complete Fix Applied

```typescript
class EnvironmentVariables {
  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsInt()
  REFRESH_TOKEN_TTL_DAYS?: number;

  // ✅ FIXED: Google OAuth variables now declared
  @IsString()
  GOOGLE_CLIENT_ID!: string;

  @IsString()
  GOOGLE_CLIENT_SECRET!: string;

  @IsString()
  GOOGLE_CALLBACK_URL!: string;

  @IsString()
  WEB_URL!: string;

  // ✅ FIXED: JobSpy variables now declared (optional)
  @IsOptional()
  @IsString()
  JOBSPY_SERVICE_URL?: string;

  @IsOptional()
  @IsString()
  JOBSPY_API_TOKEN?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  JOBSPY_TIMEOUT_MS?: number;

  // ... rest of existing fields unchanged ...
}
```

---

## Summary

| Symptom | Container has vars, ConfigService returns undefined |
|---------|---------------------------------------------------|
| **Root Cause** | `plainToInstance()` excluded undeclared properties |
| **Fix** | Declared `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` in validation class |
| **Files Changed** | `apps/api/src/config/env.validation.ts` |
| **Lines Changed** | +15 (3 Google OAuth + 3 JobSpy with decorators) |
| **Rebuild Required** | Yes (application code change) |
| **Breaking Change** | No (purely additive) |

This is a **configuration layer bug**, not a runtime bug. The variables were always present in the container — they were filtered out during NestJS initialization.
