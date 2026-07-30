import { apiClient } from '@/lib/api-client';
import { API_ROUTES, type MessageResponse, type Profile } from '@ai-career/shared';

export const usersApi = {
  getMyProfile: async (): Promise<Profile> => {
    const { data } = await apiClient.get<Profile>(API_ROUTES.USERS.PROFILE);
    return data;
  },

  markOnboardingComplete: async (): Promise<MessageResponse> => {
    const { data } = await apiClient.patch<MessageResponse>('/users/onboarding-complete');
    return data;
  },
};
