import { apiClient } from '@/lib/api-client';
import {
  AI_HEADERS,
  API_ROUTES,
  type AiCredentials,
  type AtsScore,
  type Resume,
  type ResumeSummary,
} from '@ai-career/shared';

/** Mirrors evaluations-api.ts: attached per call, never stored in axios defaults. */
function aiHeaders(credentials: AiCredentials): Record<string, string> {
  return {
    [AI_HEADERS.PROVIDER]: credentials.provider,
    [AI_HEADERS.API_KEY]: credentials.apiKey,
    ...(credentials.model ? { [AI_HEADERS.MODEL]: credentials.model } : {}),
  };
}

export const resumesApi = {
  list: async (): Promise<ResumeSummary[]> => {
    const { data } = await apiClient.get<ResumeSummary[]>(API_ROUTES.RESUMES.LIST);
    return data;
  },

  get: async (id: string): Promise<Resume> => {
    const { data } = await apiClient.get<Resume>(API_ROUTES.RESUMES.DETAIL(id));
    return data;
  },

  upload: async (
    file: File,
    options: { title?: string; isDefault?: boolean } = {},
  ): Promise<Resume> => {
    const form = new FormData();
    form.append('file', file);
    if (options.title) {
      form.append('title', options.title);
    }
    if (options.isDefault !== undefined) {
      form.append('isDefault', String(options.isDefault));
    }
    const { data } = await apiClient.post<Resume>(API_ROUTES.RESUMES.UPLOAD, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  update: async (
    id: string,
    input: { title?: string; isDefault?: boolean },
  ): Promise<Resume> => {
    const { data } = await apiClient.patch<Resume>(API_ROUTES.RESUMES.DETAIL(id), input);
    return data;
  },

  remove: async (id: string): Promise<{ message: string }> => {
    const { data } = await apiClient.delete<{ message: string }>(API_ROUTES.RESUMES.DETAIL(id));
    return data;
  },

  /**
   * Downloads the original PDF and triggers a browser save.
   *
   * Not a plain `<a href>` to the file route: that endpoint requires the bearer
   * token apiClient attaches per request, which a bare anchor navigation would
   * not carry (auth here is a header, not a cookie the browser resends for GET
   * navigations) — so the file is fetched as a blob and saved client-side instead.
   */
  downloadFile: async (id: string, filename: string): Promise<void> => {
    const { data } = await apiClient.get<Blob>(API_ROUTES.RESUMES.FILE(id), {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  atsScore: async (
    resumeId: string,
    jobId: string,
    credentials: AiCredentials,
    options: { force?: boolean } = {},
  ): Promise<AtsScore> => {
    const { data } = await apiClient.post<AtsScore>(
      API_ROUTES.RESUMES.ATS_SCORE,
      { resumeId, jobId, force: options.force ?? false },
      { headers: aiHeaders(credentials) },
    );
    return data;
  },

  findAtsScore: async (resumeId: string, jobId: string): Promise<AtsScore> => {
    const { data } = await apiClient.get<AtsScore>(
      API_ROUTES.RESUMES.ATS_SCORE_FOR_JOB(resumeId, jobId),
    );
    return data;
  },
};
