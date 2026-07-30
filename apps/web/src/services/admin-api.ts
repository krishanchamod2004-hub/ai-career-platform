import { apiClient } from '@/lib/api-client';
import {
  API_ROUTES,
  type AdminUserListItem,
  type AnalyticsOverview,
  type DailyStatPoint,
  type JobSource,
  type PaginatedResponse,
  type PlanTier,
  type QueueStats,
  type ScraperRun,
  type SourceHealth,
  type UserRole,
} from '@ai-career/shared';

export interface AdminSummary {
  enabledSources: number;
  failedRuns24h: number;
  errorLogs24h: number;
  expiredJobs: number;
}

export interface AdminLogEntry {
  id: string;
  level: string;
  message: string;
  createdAt: string;
  scope?: string;
  source?: { slug: string; name: string } | null;
}

export const adminApi = {
  summary: async (): Promise<AdminSummary> => {
    const { data } = await apiClient.get<AdminSummary>('/admin/summary');
    return data;
  },

  overview: async (): Promise<AnalyticsOverview> => {
    const { data } = await apiClient.get<AnalyticsOverview>(API_ROUTES.ANALYTICS.OVERVIEW);
    return data;
  },

  daily: async (days = 14): Promise<DailyStatPoint[]> => {
    const { data } = await apiClient.get<DailyStatPoint[]>(API_ROUTES.ANALYTICS.DAILY, {
      params: { days },
    });
    return data;
  },

  users: async (params: { page?: number; q?: string } = {}): Promise<
    PaginatedResponse<AdminUserListItem>
  > => {
    const { data } = await apiClient.get<PaginatedResponse<AdminUserListItem>>(
      API_ROUTES.ADMIN.USERS,
      { params },
    );
    return data;
  },

  setUserRole: async (id: string, role: UserRole) => {
    const { data } = await apiClient.patch(API_ROUTES.ADMIN.USER_ROLE(id), { role });
    return data;
  },

  setUserPlan: async (id: string, plan: PlanTier) => {
    const { data } = await apiClient.patch(API_ROUTES.ADMIN.USER_PLAN(id), { plan });
    return data;
  },

  scraperStatus: async (): Promise<SourceHealth[]> => {
    const { data } = await apiClient.get<SourceHealth[]>(API_ROUTES.ADMIN.SCRAPER_STATUS);
    return data;
  },

  sources: async (): Promise<JobSource[]> => {
    const { data } = await apiClient.get<JobSource[]>(API_ROUTES.ADMIN.SOURCES);
    return data;
  },

  toggleSource: async (id: string, isEnabled: boolean) => {
    const { data } = await apiClient.patch(API_ROUTES.ADMIN.SOURCE_DETAIL(id), { isEnabled });
    return data;
  },

  triggerSource: async (id: string, fullSync = false) => {
    const { data } = await apiClient.post(API_ROUTES.ADMIN.SOURCE_TRIGGER(id), null, {
      params: { fullSync },
    });
    return data;
  },

  runs: async (params: { page?: number } = {}): Promise<PaginatedResponse<ScraperRun>> => {
    const { data } = await apiClient.get<PaginatedResponse<ScraperRun>>(
      API_ROUTES.ADMIN.SCRAPER_RUNS,
      { params },
    );
    return data;
  },

  failedRuns: async (params: { page?: number } = {}): Promise<PaginatedResponse<ScraperRun>> => {
    const { data } = await apiClient.get<PaginatedResponse<ScraperRun>>(
      API_ROUTES.ADMIN.SCRAPER_FAILURES,
      { params },
    );
    return data;
  },

  retryRun: async (runId: string) => {
    const { data } = await apiClient.post(API_ROUTES.ADMIN.SCRAPER_RETRY(runId));
    return data;
  },

  logs: async (
    params: { page?: number; level?: string; channel?: 'scraper' | 'system' } = {},
  ): Promise<PaginatedResponse<AdminLogEntry>> => {
    const { data } = await apiClient.get<PaginatedResponse<AdminLogEntry>>(API_ROUTES.ADMIN.LOGS, {
      params,
    });
    return data;
  },

  queues: async (): Promise<QueueStats[]> => {
    const { data } = await apiClient.get<QueueStats[]>(API_ROUTES.ADMIN.QUEUES);
    return data;
  },
};
