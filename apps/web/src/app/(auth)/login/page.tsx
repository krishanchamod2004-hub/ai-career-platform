'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleButton } from '@/components/auth/google-button';
import { authApi } from '@/services/auth-api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Where to send the user after a successful login.
 *
 * `?redirect=` is attacker-controllable (it appears in links we hand out, e.g. the
 * pricing upsell), so only a single-slash relative path is honoured. `//evil.com`
 * is protocol-relative and would leave the site, and an absolute URL is an open
 * redirect — both fall back to the dashboard.
 */
function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return '/dashboard';
  }
  return target;
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary during prerendering.
  return (
    <React.Suspense fallback={<LoginCardShell />}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  // Handle Google OAuth callback with access token in query parameter
  React.useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    if (accessToken) {
      setIsAuthenticating(true);
      // Fetch user profile with the access token
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
        });
    }
  }, [searchParams, setAuth, router]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

  return (
    <Card className="glass-card max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Log in with Google to continue your job search.</CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive">
            <p className="text-sm text-destructive">{serverError}</p>
          </div>
        )}

        {isAuthenticating ? (
          <div className="flex items-center justify-center py-4">
            <div className="text-center space-y-2">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="text-sm text-muted-foreground">Authenticating...</p>
            </div>
          </div>
        ) : (
          <GoogleButton apiUrl={apiUrl} />
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </CardContent>
    </Card>
  );
}

/** Static shell shown while the client reads the query string. */
function LoginCardShell() {
  return (
    <Card className="glass-card max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Log in with Google to continue your job search.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-12 rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}
