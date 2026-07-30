'use client';

import Link from 'next/link';
import { Bookmark, BookmarkCheck, Clock, MapPin, Sparkles, Wallet } from 'lucide-react';
import type { EvaluationGrade, JobListItem } from '@ai-career/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GradeBadge } from '@/components/evaluations/grade-badge';
import { CompanyLogo } from '@/components/jobs/company-logo';
import { cn } from '@/lib/utils';
import { formatRelativeTime, formatSalary, humanizeEnum } from '@/lib/format';

interface JobCardProps {
  job: JobListItem;
  isSaved?: boolean;
  onToggleSave?: (job: JobListItem, isSaved: boolean) => void;
  isSaving?: boolean;
  /** AI grade for this job, when the current user has already evaluated it. */
  evaluation?: { score: number; grade: EvaluationGrade };
}

export function JobCard({ job, isSaved, onToggleSave, isSaving, evaluation }: JobCardProps) {
  const saved = isSaved ?? job.isSaved ?? false;
  const salary = formatSalary(job);

  return (
    <Card className="glass-card transition-shadow hover:shadow-md">
      <CardContent className="flex gap-4 p-5">
        <CompanyLogo
          logoUrl={job.company?.logoUrl}
          websiteUrl={job.company?.websiteUrl}
          name={job.company?.name ?? 'Unknown company'}
          size={44}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/jobs/${job.slug}`}
                className="block truncate font-semibold hover:text-primary hover:underline"
              >
                {job.title}
              </Link>
              <p className="truncate text-sm text-muted-foreground">
                {job.company?.name ?? 'Unknown company'}
              </p>
            </div>

            {onToggleSave ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
                aria-pressed={saved}
                disabled={isSaving}
                onClick={() => onToggleSave(job, saved)}
              >
                {saved ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            ) : null}
          </div>

          {evaluation ? (
            <div className="mt-2">
              <Link
                href="/dashboard/evaluations"
                className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GradeBadge grade={evaluation.grade} score={evaluation.score} size="sm" />
              </Link>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {job.isRemote ? 'Remote' : (job.location ?? 'Not specified')}
            </span>
            {salary ? (
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                {salary}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatRelativeTime(job.postedAt ?? job.createdAt)}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.excerpt}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.isEarlyAccess ? (
              <Badge variant="premium" className="gap-1">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Early access
              </Badge>
            ) : null}
            {job.jobType ? <Badge variant="outline">{humanizeEnum(job.jobType)}</Badge> : null}
            {job.experienceLevel ? (
              <Badge variant="outline">{humanizeEnum(job.experienceLevel)}</Badge>
            ) : null}
            {job.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
            {job.skills.length > 4 ? (
              <Badge variant="outline">+{job.skills.length - 4}</Badge>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('glass-card', className)}>
      <CardContent className="flex gap-4 p-5">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
