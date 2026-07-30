'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Clock,
  ExternalLink,
  GraduationCap,
  Globe2,
  MapPin,
  Plus,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { ApplicationStatus, type Job } from '@ai-career/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { JobCard } from '@/components/jobs/job-card';
import { CompanyLogo } from '@/components/jobs/company-logo';
import { GradeBadge } from '@/components/evaluations/grade-badge';
import { ScoreBreakdown } from '@/components/evaluations/score-breakdown';
import { EvaluateJobButton } from '@/components/evaluations/evaluate-job-button';
import { CheckAtsScoreButton } from '@/components/resumes/check-ats-score-button';
import { useJob, useSimilarJobs, useToggleSavedJob } from '@/hooks/use-jobs';
import { useJobEvaluation } from '@/hooks/use-evaluations';
import { useCreateApplication } from '@/hooks/use-account';
import { useAuthStore } from '@/stores/auth-store';
import { formatRelativeTime, formatSalary, humanizeEnum } from '@/lib/format';

interface JobDetailClientProps {
  idOrSlug: string;
  /**
   * Server-fetched job, used as React Query `initialData` so the page renders
   * fully on first paint (good for SEO/crawlers and avoids a loading flash) while
   * client-side interactivity (save, track, evaluate, auth-aware fields) still
   * refetches and stays live exactly as before.
   */
  initialJob?: Job;
}

export function JobDetailClient({ idOrSlug, initialJob }: JobDetailClientProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const { data: job, isLoading, isError, error } = useJob(idOrSlug, initialJob);
  const { data: similar } = useSimilarJobs(job?.id);
  const { data: evaluation } = useJobEvaluation(job?.id);
  const toggleSaved = useToggleSavedJob();
  const createApplication = useCreateApplication();
  const [trackMessage, setTrackMessage] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !job) {
    const message = (error as { response?: { data?: { message?: string } } } | undefined)?.response
      ?.data?.message;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Job unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          {message ?? 'This listing may have expired or is restricted to a higher plan.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Go back
          </Button>
          <Button asChild>
            <Link href="/jobs">Browse all jobs</Link>
          </Button>
        </div>
      </div>
    );
  }

  const salary = formatSalary(job);

  const handleToggleSave = () => {
    if (!user) {
      router.push(`/login?redirect=/jobs/${job.slug}`);
      return;
    }
    toggleSaved.mutate({ jobId: job.id, isSaved: Boolean(job.isSaved) });
  };

  const handleTrackApplication = () => {
    if (!user) {
      router.push(`/login?redirect=/jobs/${job.slug}`);
      return;
    }
    createApplication.mutate(
      { jobId: job.id, status: ApplicationStatus.APPLIED },
      {
        onSuccess: () => setTrackMessage('Added to your application tracker.'),
        onError: (mutationError) => {
          const detail = (
            mutationError as { response?: { data?: { message?: string } } }
          ).response?.data?.message;
          setTrackMessage(detail ?? 'Could not add this job to your tracker.');
        },
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/jobs">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Back to jobs
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <CompanyLogo
                  logoUrl={job.company?.logoUrl}
                  websiteUrl={job.company?.websiteUrl}
                  name={job.company?.name ?? 'Unknown company'}
                  size={56}
                  className="rounded-xl"
                />

                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
                  <p className="text-muted-foreground">
                    {job.company ? (
                      <Link href={`/jobs?companySlug=${job.company.slug}`} className="hover:underline">
                        {job.company.name}
                      </Link>
                    ) : (
                      'Unknown company'
                    )}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {evaluation ? (
                      <GradeBadge
                        grade={evaluation.grade}
                        score={evaluation.score}
                        size="sm"
                        className="mr-1"
                      />
                    ) : null}
                    {job.isEarlyAccess ? (
                      <Badge variant="premium" className="gap-1">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        Early access
                      </Badge>
                    ) : null}
                    {job.isRemote ? <Badge variant="success">Remote</Badge> : null}
                    {job.workModel ? (
                      <Badge variant="outline">{humanizeEnum(job.workModel)}</Badge>
                    ) : null}
                    {job.jobType ? <Badge variant="outline">{humanizeEnum(job.jobType)}</Badge> : null}
                    {job.experienceLevel ? (
                      <Badge variant="outline">{humanizeEnum(job.experienceLevel)}</Badge>
                    ) : null}
                    {job.visaSponsorship ? <Badge variant="success">Visa sponsorship</Badge> : null}
                  </div>
                </div>
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Location</dt>
                  <dd>{job.location ?? (job.isRemote ? 'Remote' : 'Not specified')}</dd>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Salary</dt>
                  <dd>{salary ?? job.salaryText ?? 'Not disclosed'}</dd>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Posted</dt>
                  <dd>Posted {formatRelativeTime(job.postedAt)}</dd>
                </div>
                {job.minYearsExperience !== null ? (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <dt className="sr-only">Experience required</dt>
                    <dd>{job.minYearsExperience}+ years experience</dd>
                  </div>
                ) : null}
                {job.source ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <dt className="sr-only">Source</dt>
                    <dd>via {job.source.name}</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          {job.skills.length > 0 ? (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Skills</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {job.benefits.length > 0 ? (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Benefits</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {job.benefits.map((benefit) => (
                  <Badge key={benefit} variant="outline">
                    {benefit}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">Job description</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Descriptions are normalized to plain text during ingestion, so they are
                  rendered as text rather than HTML — no sanitization gap. */}
              <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {job.description}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="glass-card">
            <CardContent className="space-y-3 p-4">
              <Button className="w-full" asChild>
                <a href={job.applyUrl ?? job.externalUrl ?? '#'} target="_blank" rel="noreferrer noopener">
                  Apply now
                  <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
                </a>
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleToggleSave}
                disabled={toggleSaved.isPending}
                aria-pressed={Boolean(job.isSaved)}
              >
                {job.isSaved ? (
                  <>
                    <BookmarkCheck className="mr-1 h-4 w-4" aria-hidden="true" />
                    Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="mr-1 h-4 w-4" aria-hidden="true" />
                    Save job
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                className="w-full"
                onClick={handleTrackApplication}
                disabled={createApplication.isPending || Boolean(job.applicationId)}
              >
                {job.applicationId ? (
                  <>
                    <Briefcase className="mr-1 h-4 w-4" aria-hidden="true" />
                    Already tracked
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    Track application
                  </>
                )}
              </Button>

              {trackMessage ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {trackMessage}
                </p>
              ) : null}

              {user ? <CheckAtsScoreButton jobId={job.id} className="w-full" /> : null}

              <p className="text-center text-xs text-muted-foreground">
                {job.viewCount.toLocaleString()} views
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  AI fit score
                </span>
                {evaluation ? (
                  <GradeBadge grade={evaluation.grade} score={evaluation.score} />
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {evaluation ? (
                <ScoreBreakdown evaluation={evaluation} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Grade this listing against your profile on six weighted criteria. Runs on your own
                  Anthropic or OpenAI key — you are asked for it once per session.
                </p>
              )}

              {user ? (
                <EvaluateJobButton jobId={job.id} hasEvaluation={Boolean(evaluation)} />
              ) : (
                <Button variant="secondary" className="w-full" asChild>
                  <Link href={`/login?redirect=/jobs/${job.slug}`}>Log in to evaluate</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {similar && similar.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Similar jobs</h2>
          <div className="space-y-3">
            {similar.map((similarJob) => (
              <JobCard key={similarJob.id} job={similarJob} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
