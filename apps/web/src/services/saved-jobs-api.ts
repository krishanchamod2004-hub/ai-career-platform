import { apiClient } from '@/lib/api-client';
import {
  API_ROUTES,
  type PaginatedResponse,
  type SavedJob,
} from '@ai-career/shared';

export const savedJobsApi = {
  list: async (params: { page?: number; pageSize?: number } = {}): Promise<
    PaginatedResponse<SavedJob>
  > => {
    const { data } = await apiClient.get<PaginatedResponse<SavedJob>>(API_ROUTES.SAVED_JOBS.LIST, {
      params,
    });
    return data;
  },

  listIds: async (): Promise<string[]> => {
    const { data } = await apiClient.get<string[]>(`${API_ROUTES.SAVED_JOBS.LIST}/ids`);
    return data;
  },

  save: async (jobId: string, notes?: string) => {
    const { data } = await apiClient.post(API_ROUTES.SAVED_JOBS.CREATE, { jobId, notes });
    return data;
  },

  updateNotes: async (jobId: string, notes: string | null) => {
    const { data } = await apiClient.patch(API_ROUTES.SAVED_JOBS.DETAIL(jobId), { notes });
    return data;
  },

  remove: async (jobId: string) => {
    const { data } = await apiClient.delete(API_ROUTES.SAVED_JOBS.DETAIL(jobId));
    return data;
  },
};
