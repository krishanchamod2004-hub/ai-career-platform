import type { Job, JobListItem, PaginatedResponse } from '@ai-career/shared';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(
  /\/+$/,
  '',
);

/**
 * Server-only, unauthenticated fetch of a single public job. Used by
 * `generateMetadata` and JSON-LD on the job detail page — deliberately does not
 * reuse `apiClient` (the axios instance in `lib/api-client.ts`), which reads
 * from the client-only Zustand auth store and cannot run on the server.
 *
 * Returns `null` on any failure (404, embargoed/expired listing, network) so
 * callers can fall back to generic metadata instead of failing the page render.
 */
export async function fetchJobServerSide(idOrSlug: string): Promise<Job | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/jobs/${encodeURIComponent(idOrSlug)}`, {
      // Job content changes as the scraper runs; a short revalidate window keeps
      // metadata/JSON-LD fresh without hitting the API on every crawl request.
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Job;
  } catch {
    return null;
  }
}

/**
 * Server-only fetch of the newest active jobs, used by `app/sitemap.ts`.
 * Pages through the public search endpoint (capped at `MAX_PAGE_SIZE` per
 * request server-side) using its cursor, up to `limit` total jobs — a single
 * oversized `pageSize` would be rejected by the API's validation (max 100).
 */
export async function fetchRecentJobsServerSide(limit = 500): Promise<JobListItem[]> {
  const pageSize = 100;
  const items: JobListItem[] = [];
  let cursor: string | undefined;

  try {
    while (items.length < limit) {
      const params = new URLSearchParams({ sortBy: 'NEWEST', pageSize: String(pageSize) });
      if (cursor) {
        params.set('cursor', cursor);
      }
      const response = await fetch(`${API_BASE_URL}/jobs?${params.toString()}`, {
        next: { revalidate: 3600 },
      });
      if (!response.ok) {
        break;
      }
      const data = (await response.json()) as PaginatedResponse<JobListItem>;
      items.push(...data.items);

      if (!data.meta.nextCursor || data.items.length === 0) {
        break;
      }
      cursor = data.meta.nextCursor;
    }
  } catch {
    // Partial results are fine for a sitemap — return whatever was collected.
  }

  return items.slice(0, limit);
}
