'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleButton } from '@/components/auth/google-button';
import { authApi } from '@/services/auth-api';
import { useAuthStore } from '@/stores/auth-store';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  // Handle Google OAuth callback with access token in query parameter
  React.useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    if (accessToken) {
      // Fetch user profile with the access token
      authApi
        .getMe(accessToken)
        .then((user) => {
          setAuth(user, accessToken);
          // Clean up URL and redirect to intended destination
          const redirect = searchParams.get('redirect');
          router.replace(safeRedirect(redirect));
        })
        .catch((error) => {
          console.error('Failed to fetch user after OAuth:', error);
          setServerError('Authentication failed. Please try again.');
        });
    }
  }, [searchParams, setAuth, router]);

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const auth = await authApi.login(values);
      setAuth(auth.user, auth.accessToken);
      router.push(safeRedirect(searchParams.get('redirect')));
    } catch (error) {
      if (isAxiosError(error) && error.response?.data?.message) {
        const message = error.response.data.message;
        setServerError(Array.isArray(message) ? message.join(', ') : message);
      } else if (isAxiosError(error) && !error.response) {
        // No response at all: the API is unreachable, not a credential problem.
        setServerError(
          'Cannot reach the server. Make sure the API is running on ' +
            (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api') +
            '.',
        );
      } else {
        setServerError('Invalid email or password.');
      }
    }
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Log in to continue your job search.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="jane@example.com" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <GoogleButton apiUrl={apiUrl} />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

/** Static shell shown while the client reads the query string. */
function LoginCardShell() {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Log in to continue your job search.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
      </CardContent>
    </Card>
  );
}
