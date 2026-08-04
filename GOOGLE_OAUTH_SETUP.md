# Google OAuth Setup Guide

This application uses **Google OAuth only** for authentication. Email/password login has been removed.

## Required Environment Variables

You must set these variables in your `.env` file for the application to start:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** (required for OAuth)

### 2. Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application** as the application type
4. Configure the OAuth consent screen if prompted:
   - User Type: External (for testing) or Internal (for organization use)
   - Fill in required app information
   - Add your email as a test user (for External type during development)

### 3. Configure Authorized Redirect URIs

Add these URIs based on your environment:

**Development:**
```
http://localhost:4000/api/auth/google/callback
```

**Production (example):**
```
https://api.yourdomain.com/api/auth/google/callback
```

### 4. Copy Credentials

After creating the OAuth client:
1. Copy the **Client ID** to `GOOGLE_CLIENT_ID`
2. Copy the **Client secret** to `GOOGLE_CLIENT_SECRET`

### 5. Test the Integration

1. Start your application:
   ```bash
   docker compose up
   # or for local development:
   pnpm --filter=@ai-career/api run dev
   pnpm --filter=@ai-career/web run dev
   ```

2. Navigate to `http://localhost:3000/login`
3. Click "Continue with Google"
4. Complete the Google authentication flow
5. You should be redirected back to the dashboard

## Troubleshooting

### Error: "Configuration key GOOGLE_CLIENT_ID does not exist"
- Make sure you've set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in your `.env` file
- Restart the API server after adding the variables

### Error: "redirect_uri_mismatch"
- The callback URL in your `.env` file must exactly match one of the authorized redirect URIs in Google Cloud Console
- Check for trailing slashes, http vs https, and port numbers

### Error: "Access blocked: This app's request is invalid"
- Make sure the **Google+ API** is enabled in your project
- Verify the OAuth consent screen is properly configured
- Add your email as a test user if using External user type

### Users from old email/password system
When an existing user logs in with Google:
- If the email matches an existing account, the Google account is automatically linked
- The user can continue using their existing data
- Password-based login is no longer available

## Production Deployment

For production:
1. Update the authorized redirect URI to your production API domain
2. Set the production values in your environment:
   ```env
   GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
   WEB_URL=https://yourdomain.com
   ```
3. Configure the OAuth consent screen for public use (if needed)
4. Rebuild the web app with production environment variables:
   ```bash
   docker compose build web
   ```

## Security Notes

- Never commit your `.env` file to version control
- Use different OAuth credentials for development and production
- Rotate credentials if they are compromised
- Keep the Google client secret secure
