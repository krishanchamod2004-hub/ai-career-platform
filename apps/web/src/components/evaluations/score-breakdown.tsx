import { CheckCircle2, Cpu, Clock, TriangleAlert } from 'lucide-react';
import {
  AI_PROVIDER_LABELS,
  EVALUATION_CRITERIA,
  EVALUATION_SCORE_MAX,
  EVALUATION_SCORE_MIN,
  type JobEvaluation,
} from '@ai-career/shared';
import { cn } from '@/lib/utils';

/** Bar fill for a 1.0-5.0 score, so a 1.0 still reads as "lowest", not "empty". */
function fillPercent(score: number): number {
  const span = EVALUATION_SCORE_MAX - EVALUATION_SCORE_MIN;
  const clamped = Math.min(EVALUATION_SCORE_MAX, Math.max(EVALUATION_SCORE_MIN, score));
  return Math.round(((clamped - EVALUATION_SCORE_MIN) / span) * 100);
}

function barColor(score: number): string {
  if (score >= 4.5) return 'bg-emerald-500';
  if (score >= 3.5) return 'bg-sky-500';
  if (score >= 2.5) return 'bg-amber-500';
  if (score >= 1.5) return 'bg-orange-500';
  return 'bg-red-500';
}

export interface ScoreBreakdownProps {
  evaluation: JobEvaluation;
  /** Hide the provider/model/latency line (e.g. in compact list rows). */
  hideMeta?: boolean;
  className?: string;
}

/**
 * Per-criterion detail behind a letter grade.
 *
 * Weights are shown next to every score because the overall grade is a weighted
 * mean — without them a user seeing "Compensation 2.0" cannot tell how much that
 * actually moved their grade.
 */
export function ScoreBreakdown({ evaluation, hideMeta, className }: ScoreBreakdownProps) {
  const scored = EVALUATION_CRITERIA.filter((criterion) => evaluation.rubric[criterion.key]);

  return (
    <div className={cn('space-y-4', className)}>
      {evaluation.summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{evaluation.summary}</p>
      ) : null}

      <dl className="space-y-3">
        {scored.map((criterion) => {
          const entry = evaluation.rubric[criterion.key];
          return (
            <div key={criterion.key}>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm font-medium" title={criterion.description}>
                  {criterion.label}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {Math.round(criterion.weight * 100)}% of grade
                  </span>
                </dt>
                <dd className="shrink-0 text-sm font-semibold tabular-nums">
                  {entry.score.toFixed(1)}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{EVALUATION_SCORE_MAX.toFixed(1)}
                  </span>
                </dd>
              </div>

              <div
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-valuenow={entry.score}
                aria-valuemin={EVALUATION_SCORE_MIN}
                aria-valuemax={EVALUATION_SCORE_MAX}
                aria-label={`${criterion.label}: ${entry.score.toFixed(1)} out of ${EVALUATION_SCORE_MAX.toFixed(1)}`}
              >
                <div
                  className={cn('h-full rounded-full transition-all', barColor(entry.score))}
                  style={{ width: `${fillPercent(entry.score)}%` }}
                />
              </div>

              {entry.notes ? (
                <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>
              ) : null}
            </div>
          );
        })}
      </dl>

      {evaluation.strengths.length > 0 || evaluation.gaps.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {evaluation.strengths.length > 0 ? (
            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                Strengths
              </h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {evaluation.strengths.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span aria-hidden="true">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {evaluation.gaps.length > 0 ? (
            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <TriangleAlert className="h-4 w-4 text-amber-500" aria-hidden="true" />
                Gaps
              </h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {evaluation.gaps.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span aria-hidden="true">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {hideMeta ? null : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
            {AI_PROVIDER_LABELS[evaluation.provider]} · {evaluation.model}
          </span>
          {evaluation.durationMs ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {(evaluation.durationMs / 1000).toFixed(1)}s
            </span>
          ) : null}
          {evaluation.promptTokens || evaluation.completionTokens ? (
            <span>
              {(evaluation.promptTokens ?? 0).toLocaleString()} in /{' '}
              {(evaluation.completionTokens ?? 0).toLocaleString()} out tokens
            </span>
          ) : null}
        </p>
      )}
    </div>
  );
}
