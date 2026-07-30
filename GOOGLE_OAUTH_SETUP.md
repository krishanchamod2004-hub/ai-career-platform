# Google OAuth 2.0 Integration - Setup Guide

This document describes the "Continue with Google" integration for the AI Career Platform.

## Architecture Overview

### Backend Flow (NestJS)
1. User clicks "Continue with Google" button → redirects to `GET /api/auth/google`
2. GoogleStrategy (Passport) redirects to Google's OAuth consent screen
3. User authorizes → Google redirects back to `GET /api/auth/google/callback`
4. Backend validates OAuth response, finds or creates user, generates JWT tokens
5. Sets refresh token in httpOnly cookie, redirects to frontend with access token in query

### Frontend Flow (Next.js)
1. Login/Register pages include GoogleButton component
2. On OAuth callback, dashboard page receives `?accessToken=...` query param
3. Frontend extracts token, fetches user profile, stores in auth state
4. User is authenticated and redirected to intended destination

## Setup Instructions

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API:
   - Navigate to **APIs & Services** → **Library**
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: "AI Career Platform"
   - **Authorized redirect URIs**:
     - Development: `http://localhost:4000/api/auth/google/callback`
     - Production: `https://api.yourdomain.com/api/auth/google/callback`
5. Copy the **Client ID** and **Client Secret**

### 2. Configure Backend Environment

Edit `apps/api/.env`:

```bash
# Google OAuth 2.0
GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret-here"
GOOGLE_CALLBACK_URL="http://localhost:4000/api/auth/google/callback"

# Must point to your Next.js frontend
WEB_URL="http://localhost:3000"
```

**Important**: The `GOOGLE_CALLBACK_URL` must **exactly match** one of the authorized redirect URIs in Google Console.

### 3. Configure Frontend Environment

Edit `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
```

### 4. Database Schema

The schema is already prepared with:
- `users.google_id` (nullable, unique) - stores Google's user ID
- `users.password_hash` (nullable) - optional for OAuth users
- `users.auth_provider` - tracks whether user signed up via LOCAL or GOOGLE

No migration is needed if you're on Phase 2 schema.

### 5. Start the Application

```bash
# Terminal 1: Start backend
cd apps/api
pnpm run dev

# Terminal 2: Start frontend
cd apps/web
pnpm run dev
```

Navigate to http://localhost:3000/login or http://localhost:3000/register to see the "Continue with Google" button.

## Implementation Details

### Backend Components

**GoogleStrategy** (`apps/api/src/modules/auth/strategies/google.strategy.ts`)
- Validates OAuth callback from Google
- Extracts user profile (email, name, avatar)
- Returns GoogleProfile object to controller

**AuthService.findOrCreateGoogleUser()**
- Finds user by `googleId` first (returning user)
- If not found, finds by `email`:
  - If exists → links Google account to existing LOCAL user
  - If not exists → creates new user with GOOGLE provider
- Google users are always `isEmailVerified: true`
- Generates JWT access token and refresh token
- Returns AuthResponse

**AuthController Routes**
- `GET /api/auth/google` - Initiates OAuth flow
- `GET /api/auth/google/callback` - Handles callback, sets cookie, redirects to frontend

### Frontend Components

**GoogleButton** (`apps/web/src/components/auth/google-button.tsx`)
- Renders button with official Google logo (SVG, no emojis)
- Redirects to backend OAuth endpoint on click

**Login/Register Pages**
- Include GoogleButton with visual separator ("Or continue with")
- Handle OAuth callback via `useEffect`:
  - Extract `accessToken` from query parameter
  - Fetch user profile with token
  - Store in auth state and redirect to dashboard

## Security Considerations

### Token Flow
- **Access Token**: Short-lived (15 min), passed via query parameter on callback
- **Refresh Token**: Long-lived (30 days), stored in httpOnly cookie
- Query parameter approach is safe because:
  - Token is immediately consumed and stored in memory
  - Token expires quickly
  - URL is cleaned up via `router.replace()`

### Account Linking
- If a user signs up with email/password, then later uses Google OAuth with the same email:
  - The accounts are **automatically linked**
  - `authProvider` is updated to GOOGLE
  - `googleId` is added
  - User can now log in with either method

### CSRF Protection
- Passport's Google strategy includes CSRF protection via state parameter
- Callback URL validation ensures requests come from Google

## Testing

### Manual Test Flow

1. **New User (Google Sign-Up)**
   - Click "Continue with Google" on `/register`
   - Authorize on Google
   - Should create new user and redirect to dashboard
   - Check database: `auth_provider = 'GOOGLE'`, `google_id` is set

2. **Existing User (Google Sign-In)**
   - Click "Continue with Google" on `/login`
   - Authorize on Google
   - Should log in existing user
   - Check database: `last_active_at` is updated

3. **Account Linking**
   - Register with email/password first
   - Log out
   - Click "Continue with Google" using the same email
   - Should link accounts (same user record, now has `google_id`)

### Troubleshooting

**Error: "Redirect URI mismatch"**
- Ensure `GOOGLE_CALLBACK_URL` in `.env` exactly matches Google Console
- Check for trailing slashes, http vs https

**Error: "Cannot GET /api/auth/google/callback"**
- Ensure backend is running on the correct port (4000)
- Check that GoogleStrategy is registered in AuthModule

**Frontend: "Authentication failed"**
- Check browser console for errors
- Verify `NEXT_PUBLIC_API_URL` points to running backend
- Ensure backend CORS allows frontend origin

**Database: "Unique constraint violation on google_id"**
- User might have clicked button multiple times
- Google OAuth can be called multiple times safely (idempotent)

## Production Deployment

### Backend (NestJS API)

Update `.env` for production:

```bash
GOOGLE_CALLBACK_URL="https://api.yourdomain.com/api/auth/google/callback"
WEB_URL="https://yourdomain.com"
JWT_ACCESS_SECRET="<generate-secure-secret>"
```

Add production callback URL to Google Console authorized redirect URIs.

### Frontend (Next.js)

Set environment variable at build time:

```bash
NEXT_PUBLIC_API_URL="https://api.yourdomain.com/api"
```

**Important**: `NEXT_PUBLIC_*` variables are baked into the build. If you change them, rebuild the frontend.

### Reverse Proxy (Caddy/Nginx)

Ensure both frontend and backend are behind HTTPS. Example Caddyfile:

```
yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:4000
}
```

## API Documentation

### GET /api/auth/google
Initiates Google OAuth flow. No parameters needed.

**Response**: Redirects to Google consent screen

---

### GET /api/auth/google/callback
Handles OAuth callback from Google. Called by Google, not directly by client.

**Query Parameters**:
- `code` - Authorization code (provided by Google)
- `state` - CSRF token (provided by Google)

**Response**: 
- Sets `refresh_token` httpOnly cookie
- Redirects to `${WEB_URL}/dashboard?accessToken=...`

---

## Files Changed

### Backend
- `apps/api/src/modules/auth/strategies/google.strategy.ts` (new)
- `apps/api/src/modules/auth/auth.service.ts` (added `findOrCreateGoogleUser`)
- `apps/api/src/modules/auth/auth.controller.ts` (added Google routes)
- `apps/api/src/modules/auth/auth.module.ts` (registered GoogleStrategy)
- `apps/api/.env.example` (added Google OAuth variables)

### Frontend
- `apps/web/src/components/auth/google-button.tsx` (new)
- `apps/web/src/app/(auth)/login/page.tsx` (added Google button + callback handler)
- `apps/web/src/app/(auth)/register/page.tsx` (added Google button)

### Packages
- Installed: `@nestjs/passport`, `passport`, `passport-google-oauth20`, `@types/passport-google-oauth20`

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Google OAuth 2.0 documentation: https://developers.google.com/identity/protocols/oauth2
3. Check Passport Google OAuth 2.0 strategy: http://www.passportjs.org/packages/passport-google-oauth20/
