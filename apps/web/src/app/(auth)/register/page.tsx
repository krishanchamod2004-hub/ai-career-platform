'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Registration is now handled through Google OAuth.
 * Redirect to login page.
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null;
}
