'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Scoped error boundary for /dashboard/resumes. Next.js prefers the nearest
 * error.tsx to the segment that threw, so a failure inside the resume list,
 * upload flow, or an ATS score card is caught here with resumes-specific
 * copy instead of falling back to the generic app/error.tsx message.
 */
export default function ResumesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Resumes page error boundary caught:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Couldn&apos;t load your resumes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong loading this page. Your uploaded resumes are safe — try again.
        </p>
      </div>
      <Button onClick={() => reset()}>
        <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
