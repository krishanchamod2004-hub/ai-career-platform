import { apiClient } from '@/lib/api-client';
import {
  API_ROUTES,
  type CompanyWithStats,
  type Job,
  type JobFacets,
  type JobListItem,
  type JobSearchQuery,
  type PaginatedResponse,
} from '@ai-career/shared';

/** Serializes a search query into the flat query-string shape the API expects. */
export function toJobSearchParams(
  query: JobSearchQuery & { cursor?: string },
): Record<string, string> {
  const params: Record<string, string> = {};

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params[key] = value.join(',');
      }
      return;
    }
    params[key] = String(value);
  });

  return params;
}

export const jobsApi = {
  search: async (
    query: JobSearchQuery & { cursor?: string },
  ): Promise<PaginatedResponse<JobListItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<JobListItem>>(API_ROUTES.JOBS.LIST, {
      params: toJobSearchParams(query),
    });
    return data;
  },

  facets: async (query: JobSearchQuery): Promise<JobFacets> => {
    const { data } = await apiClient.get<JobFacets>(API_ROUTES.JOBS.FACETS, {
      params: toJobSearchParams(query),
    });
    return data;
  },

  get: async (idOrSlug: string): Promise<Job> => {
    const { data } = await apiClient.get<Job>(API_ROUTES.JOBS.DETAIL(idOrSlug));
    return data;
  },

  similar: async (id: string, limit = 6): Promise<JobListItem[]> => {
    const { data } = await apiClient.get<JobListItem[]>(API_ROUTES.JOBS.SIMILAR(id), {
      params: { limit },
    });
    return data;
  },

  company: async (idOrSlug: string): Promise<CompanyWithStats> => {
    const { data } = await apiClient.get<CompanyWithStats>(API_ROUTES.COMPANIES.DETAIL(idOrSlug));
    return data;
  },
};
