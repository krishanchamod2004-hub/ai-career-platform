'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Email verification is no longer needed with Google OAuth-only authentication.
 * Google emails are automatically verified.
 * Redirect to login page.
 */
export default function VerifyEmailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null;
}
