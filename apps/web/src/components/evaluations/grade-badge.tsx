import { EvaluationGrade, EVALUATION_SCORE_MAX } from '@ai-career/shared';
import { cn } from '@/lib/utils';

/**
 * Five visually distinct buckets. Colour alone never carries the meaning — the
 * letter is always rendered, and the accessible label spells out the score — so
 * the badge still reads correctly for colour-blind users and screen readers.
 */
const GRADE_STYLES: Record<EvaluationGrade, string> = {
  [EvaluationGrade.A]:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  [EvaluationGrade.B]: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  [EvaluationGrade.C]: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  [EvaluationGrade.D]: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
  [EvaluationGrade.F]: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
};

export const GRADE_DESCRIPTIONS: Record<EvaluationGrade, string> = {
  [EvaluationGrade.A]: 'Excellent match — apply first',
  [EvaluationGrade.B]: 'Strong match with minor gaps',
  [EvaluationGrade.C]: 'Reasonable match, some mismatch',
  [EvaluationGrade.D]: 'Weak match — expect friction',
  [EvaluationGrade.F]: 'Poor match — likely not worth applying',
};

const SIZE_STYLES = {
  sm: 'h-6 gap-1 px-1.5 text-xs',
  md: 'h-7 gap-1.5 px-2 text-sm',
  lg: 'h-10 gap-2 px-3 text-base',
} as const;

export interface GradeBadgeProps {
  grade: EvaluationGrade;
  score?: number;
  size?: keyof typeof SIZE_STYLES;
  showScore?: boolean;
  className?: string;
}

export function GradeBadge({
  grade,
  score,
  size = 'md',
  showScore = true,
  className,
}: GradeBadgeProps) {
  const label =
    score === undefined
      ? `Grade ${grade}: ${GRADE_DESCRIPTIONS[grade]}`
      : `Grade ${grade}, ${score.toFixed(1)} out of ${EVALUATION_SCORE_MAX.toFixed(1)}: ${GRADE_DESCRIPTIONS[grade]}`;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-semibold',
        GRADE_STYLES[grade],
        SIZE_STYLES[size],
        className,
      )}
      title={GRADE_DESCRIPTIONS[grade]}
      aria-label={label}
    >
      <span aria-hidden="true">Grade {grade}</span>
      {showScore && score !== undefined ? (
        <span className="font-normal opacity-80" aria-hidden="true">
          {score.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}
