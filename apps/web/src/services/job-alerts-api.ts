import { apiClient } from '@/lib/api-client';
import {
  API_ROUTES,
  type AlertFrequency,
  type ExperienceLevel,
  type JobAlert,
  type JobType,
  type NotificationChannel,
} from '@ai-career/shared';

export interface JobAlertPayload {
  name: string;
  keywords?: string[];
  locations?: string[];
  jobTypes?: JobType[];
  experienceLevels?: ExperienceLevel[];
  skills?: string[];
  salaryMin?: number;
  isRemoteOnly?: boolean;
  frequency?: AlertFrequency;
  channels?: NotificationChannel[];
  isActive?: boolean;
}

export interface AlertPreviewJob {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  isRemote: boolean;
  postedAt: string | null;
  company: { name: string; logoUrl: string | null } | null;
}

export const jobAlertsApi = {
  list: async (): Promise<JobAlert[]> => {
    const { data } = await apiClient.get<JobAlert[]>(API_ROUTES.JOB_ALERTS.LIST);
    return data;
  },

  create: async (payload: JobAlertPayload): Promise<JobAlert> => {
    const { data } = await apiClient.post<JobAlert>(API_ROUTES.JOB_ALERTS.CREATE, payload);
    return data;
  },

  update: async (id: string, payload: Partial<JobAlertPayload>): Promise<JobAlert> => {
    const { data } = await apiClient.patch<JobAlert>(API_ROUTES.JOB_ALERTS.DETAIL(id), payload);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete(API_ROUTES.JOB_ALERTS.DETAIL(id));
    return data;
  },

  preview: async (id: string): Promise<AlertPreviewJob[]> => {
    const { data } = await apiClient.get<AlertPreviewJob[]>(API_ROUTES.JOB_ALERTS.PREVIEW(id));
    return data;
  },
};
