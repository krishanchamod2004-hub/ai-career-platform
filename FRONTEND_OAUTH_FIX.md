# Frontend OAuth Flow Fix

## Problem

After successful Google OAuth, the backend redirects to:
```
https://careersuite.cc/login?accessToken=eyJ...
```

The frontend then calls `GET /api/auth/me` **without an Authorization header**, resulting in:
- 401 Unauthorized
- "Authentication failed" error shown to user
- User not logged in despite successful OAuth

## Root Cause

**Race condition in `apps/web/src/app/(auth)/login/page.tsx`**:

```typescript
// BEFORE FIX (BROKEN):
const accessToken = searchParams.get('accessToken');
if (accessToken) {
  authApi.me()  // ❌ apiClient checks store for token, finds null!
    .then((user) => {
      setAuth(user, accessToken);  // ✅ Token stored AFTER request sent
    });
}
```

The flow was:

1. ✅ Extract `accessToken` from URL query parameter
2. ❌ Call `authApi.me()` immediately
3. ❌ `apiClient` interceptor checks `useAuthStore.getState().accessToken` → returns `null`
4. ❌ Request sent **without Authorization header**
5. ❌ Backend returns 401 Unauthorized
6. ✅ (too late) `setAuth(user, accessToken)` stores the token

## The Fix

**Store the accessToken in Zustand BEFORE calling `authApi.me()`**:

```typescript
// AFTER FIX (WORKING):
const accessToken = searchParams.get('accessToken');
if (accessToken) {
  // ✅ CRITICAL: Store token in Zustand FIRST
  useAuthStore.getState().setAccessToken(accessToken);
  
  // ✅ Now authApi.me() has the token available
  authApi.me()
    .then((user) => {
      setAuth(user, accessToken);  // Update both user and token
    })
    .catch((error) => {
      useAuthStore.getState().clearAuth();  // Clean up on error
    });
}
```

New flow:

1. ✅ Extract `accessToken` from URL query parameter
2. ✅ **Store token in Zustand immediately**
3. ✅ Call `authApi.me()`
4. ✅ `apiClient` interceptor finds token in store
5. ✅ Request sent **with Authorization: Bearer {token}**
6. ✅ Backend returns user data
7. ✅ User logged in successfully

## Files Changed

### `apps/web/src/app/(auth)/login/page.tsx`

**Before:**
```typescript
React.useEffect(() => {
  const accessToken = searchParams.get('accessToken');
  if (accessToken) {
    setIsAuthenticating(true);
    authApi
      .me()
      .then((user) => {
        setAuth(user, accessToken);
        const redirect = searchParams.get('redirect');
        router.replace(safeRedirect(redirect));
      })
      .catch((error) => {
        console.error('Failed to fetch user after OAuth:', error);
        setServerError('Authentication failed. Please try again.');
        setIsAuthenticating(false);
      });
  }
}, [searchParams, setAuth, router]);
```

**After:**
```typescript
React.useEffect(() => {
  const accessToken = searchParams.get('accessToken');
  if (accessToken) {
    setIsAuthenticating(true);
    
    // CRITICAL: Store the access token in Zustand BEFORE calling authApi.me()
    // so the API client interceptor can attach it to the Authorization header
    useAuthStore.getState().setAccessToken(accessToken);
    
    // Fetch user profile with the access token (now in store)
    authApi
      .me()
      .then((user) => {
        setAuth(user, accessToken);
        // Clean up URL and redirect to intended destination
        const redirect = searchParams.get('redirect');
        router.replace(safeRedirect(redirect));
      })
      .catch((error) => {
        console.error('Failed to fetch user after OAuth:', error);
        setServerError('Authentication failed. Please try again.');
        setIsAuthenticating(false);
        // Clear the token on error
        useAuthStore.getState().clearAuth();
      });
  }
}, [searchParams, setAuth, router]);
```

## Why This Pattern is Correct

The `apiClient` (axios instance) uses a **request interceptor** that reads the token from Zustand:

```typescript
// apps/web/src/lib/api-client.ts
apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;  // ← Reads from store
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
```

**Every API request** checks the store at request time. If the token isn't in the store when `authApi.me()` is called, the interceptor cannot add the Authorization header.

## Verification

Test the complete OAuth flow:

1. Start from logged-out state
2. Click "Sign in with Google"
3. Google redirects back with `?accessToken=...`
4. **Before fix**: 401 error, "Authentication failed"
5. **After fix**: User logged in, redirected to dashboard

Check browser network tab:
- **Before fix**: `GET /api/auth/me` has no `Authorization` header
- **After fix**: `GET /api/auth/me` has `Authorization: Bearer eyJ...`

## Related Code

- **`apps/web/src/stores/auth-store.ts`** - Zustand store holding accessToken
- **`apps/web/src/lib/api-client.ts`** - Axios interceptor reading from store
- **`apps/web/src/services/auth-api.ts`** - API methods using apiClient
- **`apps/web/src/providers/auth-provider.tsx`** - Bootstrap flow (already correct)

## Why the Auth Provider Was Fine

The `AuthProvider` already had the correct order:

```typescript
// This was already working correctly:
const response = await axios.post('/auth/refresh', ...);
useAuthStore.getState().setAccessToken(response.data.accessToken);  // ✅ First
const me = await authApi.me();  // ✅ Then
```

Only the OAuth callback flow in the login page had the bug.

## Summary

**One-line summary**: Store the OAuth accessToken in Zustand **before** calling `authApi.me()`, not after.

**Impact**: Google OAuth login now works end-to-end on production.
