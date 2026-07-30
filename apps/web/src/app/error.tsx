'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route-segment error boundary. Next.js renders this in place of the segment
 * that threw, instead of crashing the whole tree — so one broken client
 * component (e.g. a bad hook call) shows a recoverable message here rather
 * than the "missing required error components" blank-screen failure mode,
 * which happens when a render error occurs with NO error.tsx anywhere above it.
 *
 * Must be a Client Component — this is a Next.js requirement for error.tsx.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This part of the page hit an unexpected error. You can try again, or head back to the
          dashboard.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>
          <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
