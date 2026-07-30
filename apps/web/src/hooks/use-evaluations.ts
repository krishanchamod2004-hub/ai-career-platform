'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EvaluationGrade, JobEvaluation } from '@ai-career/shared';
import { evaluationsApi, type EvaluationsQuery } from '@/services/evaluations-api';
import { selectAiCredentials, useAiKeyStore } from '@/stores/ai-key-store';
import { useAuthStore } from '@/stores/auth-store';
import { jobKeys } from '@/hooks/use-jobs';

export const evaluationKeys = {
  all: ['evaluations'] as const,
  list: (query: EvaluationsQuery) => ['evaluations', 'list', query] as const,
  summary: ['evaluations', 'summary'] as const,
  models: ['evaluations', 'models'] as const,
  grades: (jobIds: string[]) => ['evaluations', 'grades', jobIds] as const,
  detail: (jobId: string) => ['evaluations', 'detail', jobId] as const,
};

/** Raised when an evaluation is requested with no key in the session. */
export class MissingAiKeyError extends Error {
  constructor() {
    super('Add your AI provider API key to run an evaluation.');
    this.name = 'MissingAiKeyError';
  }
}

/** Reads the machine-readable code the API attaches to AI failures. */
export function getAiErrorCode(error: unknown): string | null {
  const data = (error as { response?: { data?: { error?: string } } } | undefined)?.response?.data;
  return data?.error ?? null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof MissingAiKeyError) {
    return error.message;
  }
  const message = (error as { response?: { data?: { message?: string | string[] } } } | undefined)
    ?.response?.data?.message;
  if (Array.isArray(message)) {
    return message[0] ?? fallback;
  }
  return message ?? fallback;
}

export function useEvaluations(query: EvaluationsQuery = {}) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: evaluationKeys.list(query),
    queryFn: () => evaluationsApi.list(query),
    enabled: Boolean(user),
  });
}

export function useEvaluationSummary() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: evaluationKeys.summary,
    queryFn: evaluationsApi.summary,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

export function useAiModels() {
  return useQuery({
    queryKey: evaluationKeys.models,
    queryFn: evaluationsApi.models,
    staleTime: 600_000,
  });
}

export function useJobEvaluation(jobId: string | undefined) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: evaluationKeys.detail(jobId ?? ''),
    queryFn: () => evaluationsApi.forJob(jobId as string),
    enabled: Boolean(user && jobId),
    // A job with no evaluation yet is the normal case, not a transient failure.
    retry: false,
  });
}

/**
 * Grade lookup for a page of job ids, returned as a map for O(1) badge rendering.
 * The query key includes the ids so scrolling a feed does not thrash the cache.
 */
export function useEvaluationGrades(jobIds: string[]) {
  const user = useAuthStore((state) => state.user);
  const sortedIds = React.useMemo(() => [...jobIds].sort(), [jobIds]);

  const query = useQuery({
    queryKey: evaluationKeys.grades(sortedIds),
    queryFn: () => evaluationsApi.grades(sortedIds),
    enabled: Boolean(user) && sortedIds.length > 0,
    staleTime: 30_000,
  });

  const byJobId = React.useMemo(() => {
    const map = new Map<string, { score: number; grade: EvaluationGrade }>();
    for (const entry of query.data ?? []) {
      map.set(entry.jobId, { score: entry.score, grade: entry.grade });
    }
    return map;
  }, [query.data]);

  return { ...query, byJobId };
}

/**
 * Runs an evaluation with the session's credentials.
 *
 * On a rejected key the stored credential is dropped immediately, so the UI can
 * re-prompt instead of letting the user retry with a key the vendor refuses.
 */
export function useEvaluateJob() {
  const queryClient = useQueryClient();
  const clearKey = useAiKeyStore((state) => state.clear);

  return useMutation<JobEvaluation, unknown, { jobId: string; force?: boolean }>({
    mutationFn: async ({ jobId, force }) => {
      const credentials = selectAiCredentials(useAiKeyStore.getState());
      if (!credentials) {
        throw new MissingAiKeyError();
      }
      return evaluationsApi.evaluate(jobId, credentials, { force });
    },
    onSuccess: (evaluation) => {
      queryClient.setQueryData(evaluationKeys.detail(evaluation.jobId), evaluation);
      void queryClient.invalidateQueries({ queryKey: evaluationKeys.all });
      // Job cards show the grade badge, so their lists need refreshing too.
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
    onError: (error) => {
      if (getAiErrorCode(error) === 'AI_KEY_REJECTED') {
        clearKey();
      }
    },
  });
}

export function useDeleteEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => evaluationsApi.remove(jobId),
    onSuccess: (_result, jobId) => {
      queryClient.removeQueries({ queryKey: evaluationKeys.detail(jobId) });
      void queryClient.invalidateQueries({ queryKey: evaluationKeys.all });
    },
  });
}

/** Rehydrates the session key once on mount (client-only storage read). */
export function useHydrateAiKey(): boolean {
  const hydrate = useAiKeyStore((state) => state.hydrate);
  const isHydrated = useAiKeyStore((state) => state.isHydrated);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  return isHydrated;
}
