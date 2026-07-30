import { apiClient } from '@/lib/api-client';
import {
  API_ROUTES,
  type CheckoutSession,
  type CreateCheckoutRequest,
  type Entitlements,
  type Notification,
  type PaginatedResponse,
  type PlanDefinition,
  type Subscription,
  type UnreadCount,
} from '@ai-career/shared';

export const billingApi = {
  plans: async (): Promise<PlanDefinition[]> => {
    const { data } = await apiClient.get<PlanDefinition[]>(API_ROUTES.BILLING.PLANS);
    return data;
  },

  subscription: async (): Promise<Subscription> => {
    const { data } = await apiClient.get<Subscription>(API_ROUTES.BILLING.SUBSCRIPTION);
    return data;
  },

  entitlements: async (): Promise<Entitlements> => {
    const { data } = await apiClient.get<Entitlements>(API_ROUTES.BILLING.ENTITLEMENTS);
    return data;
  },

  /**
   * Starts a Lemon Squeezy checkout and returns its hosted URL.
   *
   * The account being upgraded is derived from the access token server-side, so
   * there is deliberately no user id in this payload.
   */
  createCheckout: async (payload: CreateCheckoutRequest): Promise<CheckoutSession> => {
    const { data } = await apiClient.post<CheckoutSession>(API_ROUTES.BILLING.CHECKOUT, payload);
    return data;
  },
};

export const notificationsApi = {
  list: async (
    params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {},
  ): Promise<PaginatedResponse<Notification>> => {
    const { data } = await apiClient.get<PaginatedResponse<Notification>>(
      API_ROUTES.NOTIFICATIONS.LIST,
      { params },
    );
    return data;
  },

  unreadCount: async (): Promise<UnreadCount> => {
    const { data } = await apiClient.get<UnreadCount>(API_ROUTES.NOTIFICATIONS.UNREAD_COUNT);
    return data;
  },

  markRead: async (id: string) => {
    const { data } = await apiClient.patch(API_ROUTES.NOTIFICATIONS.READ(id));
    return data;
  },

  markAllRead: async () => {
    const { data } = await apiClient.patch(API_ROUTES.NOTIFICATIONS.READ_ALL);
    return data;
  },
};

export interface UserAnalyticsSummary {
  savedJobs: number;
  applications: number;
  activeAlerts: number;
  interviews: number;
  newMatchesLast7Days: number;
}

export const analyticsApi = {
  me: async (): Promise<UserAnalyticsSummary> => {
    const { data } = await apiClient.get<UserAnalyticsSummary>(API_ROUTES.ANALYTICS.ME);
    return data;
  },
};
