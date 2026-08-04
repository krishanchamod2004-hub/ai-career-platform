'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Password reset is no longer available with Google OAuth-only authentication.
 * Redirect to login page.
 */
export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null;
}
