import { apiClient } from '@/lib/api-client';
import {
  API_ROUTES,
  type Application,
  type ApplicationBoard,
  type ApplicationStats,
  type ApplicationStatus,
  type PaginatedResponse,
} from '@ai-career/shared';

export interface CreateApplicationPayload {
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  status?: ApplicationStatus;
  jobUrl?: string;
  location?: string;
  notes?: string;
  appliedAt?: string;
  nextActionAt?: string;
  nextActionNote?: string;
}

export const applicationsApi = {
  list: async (
    params: { page?: number; pageSize?: number; status?: ApplicationStatus } = {},
  ): Promise<PaginatedResponse<Application>> => {
    const { data } = await apiClient.get<PaginatedResponse<Application>>(
      API_ROUTES.APPLICATIONS.LIST,
      { params },
    );
    return data;
  },

  board: async (): Promise<ApplicationBoard> => {
    const { data } = await apiClient.get<ApplicationBoard>(API_ROUTES.APPLICATIONS.BOARD);
    return data;
  },

  stats: async (): Promise<ApplicationStats> => {
    const { data } = await apiClient.get<ApplicationStats>(API_ROUTES.APPLICATIONS.STATS);
    return data;
  },

  create: async (payload: CreateApplicationPayload): Promise<Application> => {
    const { data } = await apiClient.post<Application>(API_ROUTES.APPLICATIONS.CREATE, payload);
    return data;
  },

  update: async (id: string, payload: Partial<CreateApplicationPayload>): Promise<Application> => {
    const { data } = await apiClient.patch<Application>(
      API_ROUTES.APPLICATIONS.DETAIL(id),
      payload,
    );
    return data;
  },

  updateStatus: async (
    id: string,
    status: ApplicationStatus,
    note?: string,
  ): Promise<Application> => {
    const { data } = await apiClient.patch<Application>(API_ROUTES.APPLICATIONS.STATUS(id), {
      status,
      note,
    });
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete(API_ROUTES.APPLICATIONS.DETAIL(id));
    return data;
  },
};
