import { apiClient } from '@/lib/api-client';
import {
  AI_HEADERS,
  API_ROUTES,
  type AiCredentials,
  type AiModelOption,
  type EvaluationGrade,
  type EvaluationSortBy,
  type EvaluationSummary,
  type JobEvaluation,
  type JobEvaluationGrade,
  type PaginatedResponse,
} from '@ai-career/shared';

export interface EvaluationsQuery {
  page?: number;
  pageSize?: number;
  grade?: EvaluationGrade;
  sortBy?: EvaluationSortBy;
}

/**
 * Builds the BYOK headers for one request.
 *
 * The key is attached per call and never stored in the axios instance defaults —
 * that would leak it onto every unrelated request (including token refreshes).
 */
function aiHeaders(credentials: AiCredentials): Record<string, string> {
  return {
    [AI_HEADERS.PROVIDER]: credentials.provider,
    [AI_HEADERS.API_KEY]: credentials.apiKey,
    ...(credentials.model ? { [AI_HEADERS.MODEL]: credentials.model } : {}),
  };
}

export const evaluationsApi = {
  list: async (query: EvaluationsQuery = {}): Promise<PaginatedResponse<JobEvaluation>> => {
    const { data } = await apiClient.get<PaginatedResponse<JobEvaluation>>(
      API_ROUTES.EVALUATIONS.LIST,
      { params: query },
    );
    return data;
  },

  summary: async (): Promise<EvaluationSummary> => {
    const { data } = await apiClient.get<EvaluationSummary>(API_ROUTES.EVALUATIONS.SUMMARY);
    return data;
  },

  models: async (): Promise<AiModelOption[]> => {
    const { data } = await apiClient.get<AiModelOption[]>(API_ROUTES.EVALUATIONS.MODELS);
    return data;
  },

  /** Grade-only lookup used to badge job lists. */
  grades: async (jobIds?: string[]): Promise<JobEvaluationGrade[]> => {
    const { data } = await apiClient.get<JobEvaluationGrade[]>(API_ROUTES.EVALUATIONS.GRADES, {
      params: jobIds && jobIds.length > 0 ? { jobIds: jobIds.join(',') } : undefined,
    });
    return data;
  },

  forJob: async (jobId: string): Promise<JobEvaluation> => {
    const { data } = await apiClient.get<JobEvaluation>(API_ROUTES.EVALUATIONS.FOR_JOB(jobId));
    return data;
  },

  evaluate: async (
    jobId: string,
    credentials: AiCredentials,
    options: { force?: boolean } = {},
  ): Promise<JobEvaluation> => {
    const { data } = await apiClient.post<JobEvaluation>(
      API_ROUTES.EVALUATIONS.FOR_JOB(jobId),
      { force: options.force ?? false },
      { headers: aiHeaders(credentials) },
    );
    return data;
  },

  remove: async (jobId: string): Promise<{ message: string }> => {
    const { data } = await apiClient.delete<{ message: string }>(
      API_ROUTES.EVALUATIONS.FOR_JOB(jobId),
    );
    return data;
  },
};
