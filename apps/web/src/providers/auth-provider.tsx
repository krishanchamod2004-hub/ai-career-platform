'use client';

import * as React from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/services/auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/**
 * On mount, attempts to restore a session using the httpOnly refresh cookie
 * (if present) by hitting /auth/refresh, then loads the current user.
 * Renders children only after this bootstrap completes so route guards
 * downstream have a definitive isInitialized flag to check.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        if (cancelled) return;
        useAuthStore.getState().setAccessToken(response.data.accessToken);
        const me = await authApi.me();
        if (cancelled) return;
        setAuth(me, response.data.accessToken);
      } catch {
        // No valid session — this is expected for logged-out visitors.
      } finally {
        if (!cancelled) setInitialized(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
