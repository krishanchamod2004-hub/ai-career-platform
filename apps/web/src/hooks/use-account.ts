'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PlanFeature,
  PlanTier,
  type ApplicationStatus,
  type CreateCheckoutRequest,
} from '@ai-career/shared';
import { billingApi, notificationsApi, analyticsApi } from '@/services/account-api';
import { applicationsApi, type CreateApplicationPayload } from '@/services/applications-api';
import { jobAlertsApi, type JobAlertPayload } from '@/services/job-alerts-api';
import { useAuthStore } from '@/stores/auth-store';

export const accountKeys = {
  entitlements: ['billing', 'entitlements'] as const,
  plans: ['billing', 'plans'] as const,
  subscription: ['billing', 'subscription'] as const,
  applications: ['applications'] as const,
  board: ['applications', 'board'] as const,
  stats: ['applications', 'stats'] as const,
  alerts: ['job-alerts'] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  summary: ['analytics', 'me'] as const,
};

/**
 * Plan entitlements drive every upsell surface in the UI. Gating is enforced
 * server-side too — this only decides what to show.
 */
export function useEntitlements() {
  const user = useAuthStore((state) => state.user);
  const query = useQuery({
    queryKey: accountKeys.entitlements,
    queryFn: billingApi.entitlements,
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const plan = query.data?.plan ?? PlanTier.FREE;
  const features = query.data?.limits.features ?? [];

  return {
    ...query,
    plan,
    hasFeature: (feature: PlanFeature) => features.includes(feature),
  };
}

export function usePlans() {
  return useQuery({ queryKey: accountKeys.plans, queryFn: billingApi.plans, staleTime: 300_000 });
}

/** The raw subscription row — used to show renewal/cancellation dates. */
export function useSubscription() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: accountKeys.subscription,
    queryFn: billingApi.subscription,
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}

/**
 * Starts a checkout and hands back the provider URL.
 *
 * The redirect is left to the caller (a plain `window.location.assign`) rather
 * than Next's router: the destination is on Lemon Squeezy's domain, so client-side
 * navigation does not apply. No optimistic plan change is made here either — the
 * plan only moves once the signed webhook lands, which is the only trustworthy
 * signal that money actually changed hands.
 */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: (payload: CreateCheckoutRequest) => billingApi.createCheckout(payload),
  });
}

/**
 * Post-checkout reconciliation.
 *
 * Lemon Squeezy redirects the browser back as soon as payment succeeds, which can
 * beat its own webhook by a few seconds. Rather than trusting the redirect (a URL
 * a user can type themselves), this re-reads entitlements a bounded number of
 * times and reports when the plan has actually changed server-side.
 */
export function useAwaitPlanUpgrade(enabled: boolean, attempts = 6, intervalMs = 2500) {
  const queryClient = useQueryClient();
  const { plan, isFetching } = useEntitlements();
  const [tries, setTries] = React.useState(0);
  const startingPlan = React.useRef<PlanTier | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    if (startingPlan.current === null) {
      startingPlan.current = plan;
    }
    if (plan !== PlanTier.FREE && plan !== startingPlan.current) {
      return; // Upgrade observed; stop polling.
    }
    if (tries >= attempts) {
      return;
    }
    const timer = setTimeout(() => {
      setTries((count) => count + 1);
      void queryClient.invalidateQueries({ queryKey: accountKeys.entitlements });
      void queryClient.invalidateQueries({ queryKey: accountKeys.subscription });
    }, intervalMs);
    return () => clearTimeout(timer);
  }, [enabled, plan, tries, attempts, intervalMs, queryClient]);

  const upgraded = startingPlan.current !== null && plan !== startingPlan.current;

  return {
    plan,
    upgraded,
    /** True while the webhook has not been reflected yet and retries remain. */
    pending: enabled && !upgraded && (tries < attempts || isFetching),
    exhausted: enabled && !upgraded && tries >= attempts,
  };
}

export function useUserSummary() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: accountKeys.summary,
    queryFn: analyticsApi.me,
    enabled: Boolean(user),
  });
}

// --- applications ----------------------------------------------------------

export function useApplicationBoard() {
  return useQuery({ queryKey: accountKeys.board, queryFn: applicationsApi.board });
}

export function useApplicationStats(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.stats,
    queryFn: applicationsApi.stats,
    enabled,
    retry: false,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateApplicationPayload) => applicationsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.applications });
    },
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      applicationsApi.updateStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.applications });
    },
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => applicationsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.applications });
    },
  });
}

// --- alerts ----------------------------------------------------------------

export function useJobAlerts() {
  return useQuery({ queryKey: accountKeys.alerts, queryFn: jobAlertsApi.list });
}

export function useCreateJobAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: JobAlertPayload) => jobAlertsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.alerts });
      void queryClient.invalidateQueries({ queryKey: accountKeys.entitlements });
    },
  });
}

export function useUpdateJobAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<JobAlertPayload> }) =>
      jobAlertsApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.alerts });
    },
  });
}

export function useDeleteJobAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jobAlertsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.alerts });
      void queryClient.invalidateQueries({ queryKey: accountKeys.entitlements });
    },
  });
}

// --- notifications ---------------------------------------------------------

export function useNotifications(unreadOnly = false) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...accountKeys.notifications, { unreadOnly }],
    queryFn: () => notificationsApi.list({ unreadOnly }),
    enabled: Boolean(user),
  });
}

export function useUnreadCount() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: accountKeys.unread,
    queryFn: notificationsApi.unreadCount,
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: accountKeys.unread });
    },
  });
}
