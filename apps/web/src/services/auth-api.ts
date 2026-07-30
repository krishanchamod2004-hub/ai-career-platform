import { apiClient } from '@/lib/api-client';
import {
  API_ROUTES,
  type AuthResponse,
  type ForgotPasswordDto,
  type LoginDto,
  type MessageResponse,
  type RegisterDto,
  type ResetPasswordDto,
  type UserWithProfile,
} from '@ai-career/shared';

export const authApi = {
  register: async (dto: RegisterDto): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>(API_ROUTES.AUTH.REGISTER, dto);
    return data;
  },

  login: async (dto: LoginDto): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>(API_ROUTES.AUTH.LOGIN, dto);
    return data;
  },

  logout: async (): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>(API_ROUTES.AUTH.LOGOUT);
    return data;
  },

  me: async (): Promise<UserWithProfile> => {
    const { data } = await apiClient.get<UserWithProfile>(API_ROUTES.AUTH.ME);
    return data;
  },

  forgotPassword: async (dto: ForgotPasswordDto): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>(API_ROUTES.AUTH.FORGOT_PASSWORD, dto);
    return data;
  },

  resetPassword: async (dto: ResetPasswordDto): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>(API_ROUTES.AUTH.RESET_PASSWORD, dto);
    return data;
  },
};
