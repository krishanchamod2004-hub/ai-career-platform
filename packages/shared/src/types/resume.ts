/**
 * Resume + ATS (Applicant Tracking System) match scoring contract.
 *
 * Mirrors the AI job-evaluation contract in `evaluation.ts`: BYOK credentials
 * are supplied per request and never appear in these types, only the vendor and
 * exact model id are persisted for auditability.
 */
import { AiProvider } from '../enums';

export interface Resume {
  id: string;
  userId: string;
  title: string;
  /** Raw text extracted from the uploaded PDF. */
  content: string;
  /** Original PDF, downloadable via GET /resumes/:id/file. Null if not stored. */
  fileUrl: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** List/card projection — omits `content`, which can be several KB of text. */
export type ResumeSummary = Omit<Resume, 'content'>;

export interface AtsScore {
  id: string;
  userId: string;
  resumeId: string;
  jobId: string;
  /** 0-100 ATS match score. */
  score: number;
  missingKeywords: string[];
  suggestions: string | null;
  provider: AiProvider;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number | null;
  createdAt: string;
  /** True when served from a stored score instead of a fresh AI call. */
  cached?: boolean;
}

export interface AtsScoreRequest {
  resumeId: string;
  jobId: string;
  /** Re-run and overwrite the stored score instead of returning the cached one. */
  force?: boolean;
}
