'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AtsScore, Resume } from '@ai-career/shared';
import { resumesApi } from '@/services/resumes-api';
import { selectAiCredentials, useAiKeyStore } from '@/stores/ai-key-store';
import { useAuthStore } from '@/stores/auth-store';
import { getAiErrorCode, MissingAiKeyError } from '@/hooks/use-evaluations';

export const resumeKeys = {
  all: ['resumes'] as const,
  list: ['resumes', 'list'] as const,
  detail: (id: string) => ['resumes', 'detail', id] as const,
  atsScore: (resumeId: string, jobId: string) => ['resumes', 'ats-score', resumeId, jobId] as const,
};

export function useResumes() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: resumeKeys.list,
    queryFn: resumesApi.list,
    enabled: Boolean(user),
  });
}

export function useResume(id: string | undefined) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: resumeKeys.detail(id ?? ''),
    queryFn: () => resumesApi.get(id as string),
    enabled: Boolean(user && id),
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      title,
      isDefault,
    }: {
      file: File;
      title?: string;
      isDefault?: boolean;
    }) => resumesApi.upload(file, { title, isDefault }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resumeKeys.list });
      // Entitlements usage (resume count) changes on upload.
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useUpdateResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      isDefault?: boolean;
    }) => resumesApi.update(id, input),
    onSuccess: (resume) => {
      queryClient.setQueryData(resumeKeys.detail(resume.id), resume);
      void queryClient.invalidateQueries({ queryKey: resumeKeys.list });
    },
  });
}

export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resumesApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: resumeKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: resumeKeys.list });
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useDownloadResume() {
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) =>
      resumesApi.downloadFile(id, filename),
  });
}

export function useAtsScore(resumeId: string | undefined, jobId: string | undefined) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: resumeKeys.atsScore(resumeId ?? '', jobId ?? ''),
    queryFn: () => resumesApi.findAtsScore(resumeId as string, jobId as string),
    enabled: Boolean(user && resumeId && jobId),
    // No score yet is the normal case for a job that hasn't been checked.
    retry: false,
  });
}

/**
 * Runs an ATS check with the session's BYOK credentials — same
 * on-rejected-key/clear-and-reprompt behavior as useEvaluateJob.
 */
export function useRunAtsScore() {
  const queryClient = useQueryClient();
  const clearKey = useAiKeyStore((state) => state.clear);

  return useMutation<
    AtsScore,
    unknown,
    { resumeId: string; jobId: string; force?: boolean }
  >({
    mutationFn: async ({ resumeId, jobId, force }) => {
      const credentials = selectAiCredentials(useAiKeyStore.getState());
      if (!credentials) {
        throw new MissingAiKeyError();
      }
      return resumesApi.atsScore(resumeId, jobId, credentials, { force });
    },
    onSuccess: (score) => {
      queryClient.setQueryData(resumeKeys.atsScore(score.resumeId, score.jobId), score);
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (error) => {
      if (getAiErrorCode(error) === 'AI_KEY_REJECTED') {
        clearKey();
      }
    },
  });
}
