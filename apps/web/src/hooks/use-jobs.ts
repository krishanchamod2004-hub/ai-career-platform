'use client';

import * as React from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { JobSearchQuery, PaginatedResponse, JobListItem, Job } from '@ai-career/shared';
import { jobsApi } from '@/services/jobs-api';
import { savedJobsApi } from '@/services/saved-jobs-api';
import { useAuthStore } from '@/stores/auth-store';

export const jobKeys = {
  all: ['jobs'] as const,
  list: (query: JobSearchQuery) => ['jobs', 'list', query] as const,
  facets: (query: JobSearchQuery) => ['jobs', 'facets', query] as const,
  detail: (idOrSlug: string) => ['jobs', 'detail', idOrSlug] as const,
  similar: (id: string) => ['jobs', 'similar', id] as const,
  saved: ['saved-jobs'] as const,
};

/**
 * Cursor-based infinite list. The API returns `meta.nextCursor`, which is stable
 * under concurrent inserts — important here because the scraper adds jobs while
 * users are browsing (offset pagination would duplicate/skip rows).
 */
export function useInfiniteJobs(query: JobSearchQuery) {
  return useInfiniteQuery({
    queryKey: jobKeys.list(query),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => jobsApi.search({ ...query, cursor: pageParam }),
    getNextPageParam: (lastPage: PaginatedResponse<JobListItem>) => lastPage.meta.nextCursor ?? undefined,
  });
}

export function useJobFacets(query: JobSearchQuery) {
  return useQuery({
    queryKey: jobKeys.facets(query),
    queryFn: () => jobsApi.facets(query),
    staleTime: 60_000,
  });
}

export function useJob(idOrSlug: string, initialData?: Job) {
  return useQuery({
    queryKey: jobKeys.detail(idOrSlug),
    queryFn: () => jobsApi.get(idOrSlug),
    enabled: Boolean(idOrSlug),
    initialData,
  });
}

export function useSimilarJobs(id: string | undefined) {
  return useQuery({
    queryKey: jobKeys.similar(id ?? ''),
    queryFn: () => jobsApi.similar(id as string),
    enabled: Boolean(id),
  });
}

export function useSavedJobs(page = 1) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...jobKeys.saved, page],
    queryFn: () => savedJobsApi.list({ page }),
    enabled: Boolean(user),
  });
}

export function useSavedJobIds() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...jobKeys.saved, 'ids'],
    queryFn: () => savedJobsApi.listIds(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

/** Toggles a bookmark and refreshes every list that shows bookmark state. */
export function useToggleSavedJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, isSaved }: { jobId: string; isSaved: boolean }) => {
      if (isSaved) {
        return savedJobsApi.remove(jobId);
      }
      return savedJobsApi.save(jobId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.saved });
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

/** Fires `onIntersect` when the sentinel scrolls into view (infinite scroll). */
export function useIntersectionObserver(
  onIntersect: () => void,
  options: { enabled?: boolean } = {},
): React.RefObject<HTMLDivElement> {
  const ref = React.useRef<HTMLDivElement>(null);
  const enabled = options.enabled ?? true;
  const callbackRef = React.useRef(onIntersect);
  callbackRef.current = onIntersect;

  React.useEffect(() => {
    const element = ref.current;
    if (!element || !enabled || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
