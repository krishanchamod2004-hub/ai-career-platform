'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RequireAuth } from '@/components/auth/require-auth';
import { SiteHeader } from '@/components/site-header';
import { JobCard, JobCardSkeleton } from '@/components/jobs/job-card';
import { useSavedJobs, useToggleSavedJob } from '@/hooks/use-jobs';
import { useEntitlements } from '@/hooks/use-account';

export default function SavedJobsPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main>
          <SavedJobsContent />
        </main>
      </div>
    </RequireAuth>
  );
}

function SavedJobsContent() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useSavedJobs(page);
  const toggleSaved = useToggleSavedJob();
  const { data: entitlements } = useEntitlements();

  const limit = entitlements?.limits.maxSavedJobs ?? null;
  const used = entitlements?.usage.savedJobs ?? data?.meta.totalItems ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Bookmark className="h-6 w-6 text-primary" aria-hidden="true" />
            Saved jobs
          </h1>
          <p className="text-muted-foreground">
            {data?.meta.totalItems ?? 0} bookmarked {data?.meta.totalItems === 1 ? 'job' : 'jobs'}
          </p>
        </div>
        <Badge variant={limit !== null && used >= limit ? 'warning' : 'outline'}>
          {limit === null ? `${used} saved · unlimited` : `${used} / ${limit} used`}
        </Badge>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <JobCardSkeleton key={index} />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No saved jobs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookmark roles while browsing to build a shortlist.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/jobs">Browse jobs</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((saved) => (
            <div key={saved.id} className="space-y-1">
              <JobCard
                job={saved.job}
                isSaved
                isSaving={toggleSaved.isPending}
                onToggleSave={(job) => toggleSaved.mutate({ jobId: job.id, isSaved: true })}
              />
              {saved.notes ? (
                <p className="pl-2 text-xs text-muted-foreground">Note: {saved.notes}</p>
              ) : null}
            </div>
          ))}

          {(data?.meta.totalPages ?? 1) > 1 ? (
            <nav className="flex items-center justify-between pt-4" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data?.meta.page} of {data?.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!data?.meta.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
