import { cn } from '@/lib/utils';

/**
 * Circular progress ring for a 0-100 score.
 *
 * Colour is a secondary cue, never the only one — the numeric score is always
 * rendered in the center, so the meaning survives for colour-blind users.
 */
export interface CircularScoreProps {
  /** 0-100 */
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

function colorForScore(score: number): { ring: string; text: string } {
  if (score > 80) {
    return { ring: 'text-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (score >= 50) {
    return { ring: 'text-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  }
  return { ring: 'text-red-500', text: 'text-red-600 dark:text-red-400' };
}

export function CircularScore({
  score,
  size = 120,
  strokeWidth = 10,
  label,
  className,
}: CircularScoreProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const { ring, text } = colorForScore(clamped);

  return (
    <div
      className={cn('inline-flex flex-col items-center gap-2', className)}
      role="img"
      aria-label={`${label ?? 'Match score'}: ${clamped} out of 100`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn('transition-[stroke-dashoffset] duration-700 ease-out', ring)}
            stroke="currentColor"
          />
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          aria-hidden="true"
        >
          <span className={cn('text-2xl font-bold tabular-nums', text)}>{clamped}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            / 100
          </span>
        </div>
      </div>
      {label ? <span className="text-sm font-medium text-muted-foreground">{label}</span> : null}
    </div>
  );
}
