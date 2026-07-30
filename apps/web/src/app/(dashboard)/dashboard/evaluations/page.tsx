'use client';

import * as React from 'react';
import Link from 'next/link';
import { KeyRound, Search, Sparkles } from 'lucide-react';
import {
  EVALUATION_SCORE_MAX,
  EvaluationGrade,
  EvaluationSortBy,
  AI_PROVIDER_LABELS,
} from '@ai-career/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { GradeBadge, GRADE_DESCRIPTIONS } from '@/components/evaluations/grade-badge';
import { EvaluationCard } from '@/components/evaluations/evaluation-card';
import { ApiKeyDialog } from '@/components/evaluations/api-key-dialog';
import {
  useDeleteEvaluation,
  useEvaluations,
  useEvaluationSummary,
  useHydrateAiKey,
} from '@/hooks/use-evaluations';
import { useAiKeyStore } from '@/stores/ai-key-store';

const SORT_LABELS: Record<EvaluationSortBy, string> = {
  [EvaluationSortBy.SCORE_DESC]: 'Best match first',
  [EvaluationSortBy.SCORE_ASC]: 'Worst match first',
  [EvaluationSortBy.NEWEST]: 'Recently graded',
  [EvaluationSortBy.OLDEST]: 'Oldest first',
};

const GRADE_ORDER = [
  EvaluationGrade.A,
  EvaluationGrade.B,
  EvaluationGrade.C,
  EvaluationGrade.D,
  EvaluationGrade.F,
];

export default function EvaluationsPage() {
  useHydrateAiKey();
  const hasKey = useAiKeyStore((state) => Boolean(state.apiKey));
  const provider = useAiKeyStore((state) => state.provider);
  const model = useAiKeyStore((state) => state.model);

  const [grade, setGrade] = React.useState<EvaluationGrade | ''>('');
  const [sortBy, setSortBy] = React.useState<EvaluationSortBy>(EvaluationSortBy.SCORE_DESC);
  const [page, setPage] = React.useState(1);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = React.useState(false);

  const query = React.useMemo(
    () => ({ page, pageSize: 10, sortBy, ...(grade ? { grade } : {}) }),
    [page, sortBy, grade],
  );

  const { data, isLoading, isError } = useEvaluations(query);
  const { data: summary } = useEvaluationSummary();
  const deleteEvaluation = useDeleteEvaluation();

  const evaluations = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI job evaluations</h2>
          <p className="text-muted-foreground">
            Every job you grade is scored 1.0–{EVALUATION_SCORE_MAX.toFixed(1)} across six weighted
            criteria and mapped to an A–F grade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsKeyDialogOpen(true)}>
            <KeyRound className="mr-1 h-4 w-4" aria-hidden="true" />
            {hasKey ? 'Change AI key' : 'Add AI key'}
          </Button>
          <Button asChild>
            <Link href="/jobs">
              <Search className="mr-1 h-4 w-4" aria-hidden="true" />
              Find jobs to grade
            </Link>
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {hasKey
          ? `Using your ${AI_PROVIDER_LABELS[provider]} key with ${model} for this session.`
          : 'No AI key in this session — you will be asked for one the first time you evaluate a job.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Jobs evaluated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">One grade per job, re-runnable any time</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.averageScore === null || summary?.averageScore === undefined
                ? '—'
                : summary.averageScore.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all graded jobs, out of {EVALUATION_SCORE_MAX.toFixed(1)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Grade distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {GRADE_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setGrade((current) => (current === option ? '' : option));
                  setPage(1);
                }}
                aria-pressed={grade === option}
                title={`Filter by ${GRADE_DESCRIPTIONS[option]}`}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  grade === option ? 'border-primary bg-primary/5' : 'border-transparent'
                }`}
              >
                <GradeBadge grade={option} size="sm" showScore={false} />
                <span className="text-sm font-semibold tabular-nums">
                  {summary?.byGrade?.[option] ?? 0}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {meta ? `${meta.totalItems} evaluation${meta.totalItems === 1 ? '' : 's'}` : ' '}
          {grade ? ` graded ${grade}` : ''}
        </p>
        <div className="flex gap-2">
          <Select
            aria-label="Filter by grade"
            className="w-40"
            value={grade}
            onChange={(event) => {
              setGrade(event.target.value as EvaluationGrade | '');
              setPage(1);
            }}
          >
            <option value="">All grades</option>
            {GRADE_ORDER.map((option) => (
              <option key={option} value={option}>
                Grade {option}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Sort evaluations"
            className="w-48"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as EvaluationSortBy);
              setPage(1);
            }}
          >
            {Object.values(EvaluationSortBy).map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <section aria-busy={isLoading} className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))
        ) : isError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
            <p className="font-medium text-destructive">Could not load your evaluations</p>
            <p className="mt-1 text-muted-foreground">Refresh the page to try again.</p>
          </div>
        ) : evaluations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
            <p className="mt-2 font-medium">
              {grade ? `No jobs graded ${grade} yet` : 'No evaluations yet'}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Open any job and choose “Evaluate with AI”. Grades use your own Anthropic or OpenAI
              key, and your profile — skills, experience, salary expectation — is the candidate side
              of the rubric, so keep it current.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard/profile">Update profile</Link>
              </Button>
              <Button asChild>
                <Link href="/jobs">Browse jobs</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {evaluations.map((evaluation, index) => (
              <EvaluationCard
                key={evaluation.id}
                evaluation={evaluation}
                defaultExpanded={index === 0}
                isDeleting={deleteEvaluation.isPending}
                onDelete={(jobId) => deleteEvaluation.mutate(jobId)}
              />
            ))}

            {meta && meta.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <ApiKeyDialog open={isKeyDialogOpen} onClose={() => setIsKeyDialogOpen(false)} />
    </div>
  );
}
