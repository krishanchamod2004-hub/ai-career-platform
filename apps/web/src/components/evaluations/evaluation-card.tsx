'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, Clock, MapPin, Trash2 } from 'lucide-react';
import type { JobEvaluation } from '@ai-career/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GradeBadge } from '@/components/evaluations/grade-badge';
import { ScoreBreakdown } from '@/components/evaluations/score-breakdown';
import { EvaluateJobButton } from '@/components/evaluations/evaluate-job-button';
import { CompanyLogo } from '@/components/jobs/company-logo';
import { formatRelativeTime } from '@/lib/format';

export interface EvaluationCardProps {
  evaluation: JobEvaluation;
  onDelete?: (jobId: string) => void;
  isDeleting?: boolean;
  /** Expanded on first render — used for the top result on the dashboard. */
  defaultExpanded?: boolean;
}

export function EvaluationCard({
  evaluation,
  onDelete,
  isDeleting,
  defaultExpanded = false,
}: EvaluationCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const detailsId = React.useId();
  const job = evaluation.job;

  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <CompanyLogo
            logoUrl={job?.company?.logoUrl}
            websiteUrl={job?.company?.websiteUrl}
            name={job?.company?.name ?? 'Unknown company'}
            size={44}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                {job ? (
                  <Link
                    href={`/jobs/${job.slug}`}
                    className="block truncate font-semibold hover:text-primary hover:underline"
                  >
                    {job.title}
                  </Link>
                ) : (
                  <p className="truncate font-semibold text-muted-foreground">
                    Job no longer available
                  </p>
                )}
                <p className="truncate text-sm text-muted-foreground">
                  {job?.company?.name ?? 'Unknown company'}
                </p>
              </div>

              <GradeBadge grade={evaluation.grade} score={evaluation.score} size="lg" />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {job ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {job.isRemote ? 'Remote' : (job.location ?? 'Not specified')}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Graded {formatRelativeTime(evaluation.updatedAt)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded((value) => !value)}
                aria-expanded={isExpanded}
                aria-controls={detailsId}
              >
                <ChevronDown
                  className={`mr-1 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
                {isExpanded ? 'Hide breakdown' : 'Score breakdown'}
              </Button>

              <EvaluateJobButton
                jobId={evaluation.jobId}
                hasEvaluation
                variant="ghost"
                size="sm"
                showError={false}
                className="w-auto"
              />

              {onDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={isDeleting}
                  onClick={() => onDelete(evaluation.jobId)}
                >
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
            </div>

            {isExpanded ? (
              <div id={detailsId} className="mt-4 border-t pt-4">
                <ScoreBreakdown evaluation={evaluation} />
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
