import { AlertTriangle, Lightbulb } from 'lucide-react';
import type { AtsScore } from '@ai-career/shared';
import { Badge } from '@/components/ui/badge';
import { CircularScore } from '@/components/resumes/circular-score';

export interface AtsScoreCardProps {
  score: AtsScore;
}

/** Visual result of an ATS check: score ring, missing-keyword pills, suggestions. */
export function AtsScoreCard({ score }: AtsScoreCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <CircularScore score={score.score} label="ATS match" />
      </div>

      {score.missingKeywords.length > 0 ? (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            Missing keywords
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {score.missingKeywords.map((keyword) => (
              <Badge key={keyword} variant="warning">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {score.suggestions ? (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <Lightbulb className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            AI suggestions to improve
          </h4>
          <p className="text-sm text-muted-foreground">{score.suggestions}</p>
        </div>
      ) : null}
    </div>
  );
}

export function AtsScoreCardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <div className="h-[120px] w-[120px] animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
