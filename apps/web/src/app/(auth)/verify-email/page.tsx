'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { API_ROUTES } from '@ai-career/shared';

type VerificationState = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [state, setState] = React.useState<VerificationState>('verifying');

  React.useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }
    apiClient
      .post(API_ROUTES.AUTH.VERIFY_EMAIL, { token })
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="glass-card w-full max-w-md">
        <CardHeader className="items-center text-center">
          {state === 'success' ? (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          ) : state === 'error' ? (
            <XCircle className="h-12 w-12 text-destructive" />
          ) : (
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <CardTitle className="mt-4">
            {state === 'verifying' && 'Verifying your email...'}
            {state === 'success' && 'Email verified!'}
            {state === 'error' && 'Verification failed'}
          </CardTitle>
          <CardDescription>
            {state === 'success' && 'Your email has been verified. You can now log in.'}
            {state === 'error' && 'This link is invalid or has expired. Please request a new one.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={() => router.push('/login')}>Go to login</Button>
        </CardContent>
      </Card>
    </div>
  );
}
