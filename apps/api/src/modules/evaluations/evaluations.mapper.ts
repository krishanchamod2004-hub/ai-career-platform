import type { Prisma } from '@prisma/client';
import {
  EVALUATION_CRITERIA,
  type AiProvider,
  type EvaluationGrade,
  type EvaluationRubric,
  type JobEvaluation,
} from '@ai-career/shared';
import { jobListSelect, toJobListItem, type JobListRow } from '../jobs/jobs.mapper';

export const evaluationWithJobInclude = {
  job: { select: jobListSelect },
} satisfies Prisma.JobEvaluationInclude;

export type EvaluationRow = Prisma.JobEvaluationGetPayload<{
  include: typeof evaluationWithJobInclude;
}>;
export type EvaluationRowWithoutJob = Prisma.JobEvaluationGetPayload<Record<string, never>>;

/**
 * `rubric` is stored as JSON, so it is untyped coming back out of Postgres.
 * Rebuild it against the criteria catalog: rows written before a criterion was
 * added (or by an older parser) then simply omit that dimension instead of
 * surfacing `undefined.score` to the UI.
 */
export function normalizeStoredRubric(value: Prisma.JsonValue | null): EvaluationRubric {
  const source = (value ?? {}) as Record<string, { score?: unknown; notes?: unknown } | undefined>;
  const rubric = {} as EvaluationRubric;

  for (const criterion of EVALUATION_CRITERIA) {
    const entry = source[criterion.key];
    const score = typeof entry?.score === 'number' ? entry.score : null;
    if (score === null) {
      continue;
    }
    rubric[criterion.key] = {
      score,
      weight: criterion.weight,
      notes: typeof entry?.notes === 'string' ? entry.notes : null,
    };
  }

  return rubric;
}

export function toJobEvaluation(
  row: EvaluationRow | EvaluationRowWithoutJob,
  options: { cached?: boolean; savedJobIds?: Set<string> } = {},
): JobEvaluation {
  const job = (row as EvaluationRow).job as JobListRow | undefined;

  return {
    id: row.id,
    jobId: row.jobId,
    score: row.score,
    grade: row.grade as EvaluationGrade,
    rubric: normalizeStoredRubric(row.rubric),
    summary: row.summary,
    strengths: row.strengths,
    gaps: row.gaps,
    provider: row.provider as AiProvider,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(job ? { job: toJobListItem(job, { savedJobIds: options.savedJobIds }) } : {}),
    ...(options.cached === undefined ? {} : { cached: options.cached }),
  };
}
