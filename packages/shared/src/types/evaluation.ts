/**
 * AI job-evaluation contract, shared by the API, the web app and any future client.
 *
 * The scoring scale is 1.0-5.0 and the letter grade is always derived from it via
 * `scoreToGrade` (see ../enums.ts) so no two surfaces can disagree about what a
 * 4.4 means.
 *
 * The user's LLM credentials are supplied per request and are never persisted,
 * which is why nothing in these types carries a key — only the vendor and the
 * exact model id, for auditability.
 */
import { AiProvider, EvaluationGrade } from '../enums';
import type { JobListItem } from './job';

/** Rubric dimensions. Keys are stable identifiers persisted inside the JSON rubric. */
export type EvaluationCriterionKey =
  | 'skillsMatch'
  | 'experienceMatch'
  | 'compensation'
  | 'locationFit'
  | 'roleClarity'
  | 'growthPotential';

export interface EvaluationCriterionDefinition {
  key: EvaluationCriterionKey;
  label: string;
  /** Share of the overall score. All weights sum to 1. */
  weight: number;
  /** Instruction handed to the model, and the tooltip shown in the UI. */
  description: string;
}

/** One scored dimension as returned by the model and stored in `rubric`. */
export interface EvaluationCriterionScore {
  score: number;
  weight: number;
  notes: string | null;
}

export type EvaluationRubric = Record<EvaluationCriterionKey, EvaluationCriterionScore>;

export interface JobEvaluation {
  id: string;
  jobId: string;
  /** Weighted 1.0-5.0 overall fit, recomputed server-side from the rubric. */
  score: number;
  grade: EvaluationGrade;
  rubric: EvaluationRubric;
  summary: string | null;
  strengths: string[];
  gaps: string[];
  provider: AiProvider;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
  /** Present on list responses so the dashboard can render the job alongside its grade. */
  job?: JobListItem;
  /** True when the response was served from a stored evaluation (no tokens spent). */
  cached?: boolean;
}

/** Lightweight projection used to badge job lists without loading full evaluations. */
export interface JobEvaluationGrade {
  jobId: string;
  score: number;
  grade: EvaluationGrade;
}

export interface EvaluationSummary {
  total: number;
  averageScore: number | null;
  byGrade: Record<EvaluationGrade, number>;
}

/** Credentials the client attaches to an evaluate request (headers, never a body). */
export interface AiCredentials {
  provider: AiProvider;
  apiKey: string;
  /** Optional override; the provider default is used when omitted. */
  model?: string;
}

export interface AiModelOption {
  provider: AiProvider;
  model: string;
  label: string;
  /** Rough positioning to help users pick: cheapest vs. most capable. */
  hint?: string;
}

export interface EvaluateJobRequest {
  /** Re-run and overwrite an existing evaluation instead of returning the stored one. */
  force?: boolean;
}
