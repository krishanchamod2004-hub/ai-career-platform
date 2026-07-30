'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search, SlidersHorizontal } from 'lucide-react';
import {
  JobSortBy,
  PlanFeature,
  type JobListItem,
  type JobSearchQuery,
} from '@ai-career/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { JobCard, JobCardSkeleton } from '@/components/jobs/job-card';
import { JobFilters } from '@/components/jobs/job-filters';
import {
  useInfiniteJobs,
  useIntersectionObserver,
  useJobFacets,
  useSavedJobIds,
  useToggleSavedJob,
} from '@/hooks/use-jobs';
import { useEntitlements } from '@/hooks/use-account';
import { useEvaluationGrades } from '@/hooks/use-evaluations';
import { useAuthStore } from '@/stores/auth-store';
import { humanizeEnum } from '@/lib/format';

const SORT_LABELS: Record<JobSortBy, string> = {
  [JobSortBy.NEWEST]: 'Newest first',
  [JobSortBy.OLDEST]: 'Oldest first',
  [JobSortBy.SALARY_DESC]: 'Highest salary',
  [JobSortBy.SALARY_ASC]: 'Lowest salary',
  [JobSortBy.RELEVANCE]: 'Most viewed',
};

/** Reads the initial filter state from the URL so searches are shareable. */
function parseQueryFromUrl(params: URLSearchParams): JobSearchQuery {
  const asArray = (key: string): string[] | undefined => {
    const raw = params.get(key);
    if (!raw) return undefined;
    const values = raw.split(',').filter(Boolean);
    return values.length > 0 ? values : undefined;
  };

  return {
    q: params.get('q') ?? undefined,
    sortBy: (params.get('sortBy') as JobSortBy | null) ?? JobSortBy.NEWEST,
    isRemote: params.get('isRemote') === 'true' ? true : undefined,
    jobTypes: asArray('jobTypes') as JobSearchQuery['jobTypes'],
    experienceLevels: asArray('experienceLevels') as JobSearchQuery['experienceLevels'],
    skills: asArray('skills'),
    location: params.get('location') ?? undefined,
    salaryMin: params.get('salaryMin') ? Number(params.get('salaryMin')) : undefined,
    postedWithinDays: params.get('postedWithinDays')
      ? Number(params.get('postedWithinDays'))
      : undefined,
    visaSponsorship: params.get('visaSponsorship') === 'true' ? true : undefined,
    pageSize: 20,
  };
}

export default function JobsPage() {
  // useSearchParams requires a Suspense boundary during prerendering.
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 py-8">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </div>
        </div>
      }
    >
      <JobsBrowser />
    </React.Suspense>
  );
}

function JobsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const { hasFeature } = useEntitlements();
  const hasAdvancedFilters = hasFeature(PlanFeature.ADVANCED_FILTERS);

  const [query, setQuery] = React.useState<JobSearchQuery>(() =>
    parseQueryFromUrl(new URLSearchParams(searchParams.toString())),
  );
  const [searchInput, setSearchInput] = React.useState(query.q ?? '');
  const [showFiltersOnMobile, setShowFiltersOnMobile] = React.useState(false);

  // Keep the address bar in sync so filters survive refresh/sharing.
  React.useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || key === 'pageSize') return;
      params.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    router.replace(`/jobs${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [query, router]);

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteJobs(query);
  const { data: facets } = useJobFacets(query);
  const { data: savedIds } = useSavedJobIds();
  const toggleSaved = useToggleSavedJob();

  const sentinelRef = useIntersectionObserver(
    () => {
      if (hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    { enabled: Boolean(hasNextPage) },
  );

  const jobs: JobListItem[] = React.useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const totalItems = data?.pages[0]?.meta.totalItems ?? 0;
  const savedSet = React.useMemo(() => new Set(savedIds ?? []), [savedIds]);

  // Grade badges for jobs this user has already evaluated. Scoped to the ids on
  // screen so the lookup stays bounded as the infinite list grows.
  const visibleJobIds = React.useMemo(() => jobs.map((job) => job.id), [jobs]);
  const { byJobId: gradesByJobId } = useEvaluationGrades(visibleJobIds);

  const handleSubmitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery((current) => ({ ...current, q: searchInput.trim() || undefined }));
  };

  const handleToggleSave = (job: JobListItem, isSaved: boolean) => {
    if (!user) {
      router.push('/login?redirect=/jobs');
      return;
    }
    toggleSaved.mutate({ jobId: job.id, isSaved });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Find your next role</h1>
        <p className="text-muted-foreground">
          {totalItems.toLocaleString()} jobs collected automatically from Greenhouse, Lever, and
          RemoteOK.
        </p>
      </header>

      <form onSubmit={handleSubmitSearch} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Job title, company, or keyword"
            aria-label="Search jobs"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select
            aria-label="Sort jobs"
            className="sm:w-48"
            value={query.sortBy ?? JobSortBy.NEWEST}
            onChange={(event) =>
              setQuery((current) => ({ ...current, sortBy: event.target.value as JobSortBy }))
            }
          >
            {Object.values(JobSortBy).map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option] ?? humanizeEnum(option)}
              </option>
            ))}
          </Select>
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            className="lg:hidden"
            onClick={() => setShowFiltersOnMobile((visible) => !visible)}
            aria-expanded={showFiltersOnMobile}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className={showFiltersOnMobile ? 'block' : 'hidden lg:block'}>
          <JobFilters
            value={query}
            facets={facets}
            hasAdvancedFilters={hasAdvancedFilters}
            onChange={setQuery}
            onReset={() => {
              setSearchInput('');
              setQuery({ sortBy: JobSortBy.NEWEST, pageSize: 20 });
            }}
          />
        </aside>

        <section aria-live="polite" aria-busy={isLoading}>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <JobCardSkeleton key={index} />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
              <p className="font-medium text-destructive">Could not load jobs</p>
              <p className="mt-1 text-muted-foreground">
                {(error as Error | undefined)?.message ??
                  'Something went wrong. Try adjusting your filters.'}
              </p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="font-medium">No jobs match these filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try widening your search, or check back after the next scrape.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSaved={savedSet.has(job.id) || job.isSaved}
                  isSaving={toggleSaved.isPending}
                  onToggleSave={handleToggleSave}
                  evaluation={gradesByJobId.get(job.id)}
                />
              ))}

              <div ref={sentinelRef} className="h-1" aria-hidden="true" />

              {isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading more jobs…
                </div>
              ) : hasNextPage ? (
                <div className="flex justify-center py-4">
                  <Button variant="outline" onClick={() => void fetchNextPage()}>
                    Load more
                  </Button>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  You have reached the end of the list.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
