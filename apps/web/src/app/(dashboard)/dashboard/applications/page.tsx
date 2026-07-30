'use client';

import * as React from 'react';
import Link from 'next/link';
import { BarChart3, Briefcase, ExternalLink, Lock, Plus, Trash2 } from 'lucide-react';
import { ApplicationStatus, PlanFeature, type Application } from '@ai-career/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useApplicationBoard,
  useApplicationStats,
  useCreateApplication,
  useDeleteApplication,
  useEntitlements,
  useUpdateApplicationStatus,
} from '@/hooks/use-account';
import { formatPercent, formatRelativeTime, humanizeEnum } from '@/lib/format';

const COLUMN_ORDER: ApplicationStatus[] = [
  ApplicationStatus.SAVED,
  ApplicationStatus.APPLIED,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
];

const COLUMN_STYLES: Record<ApplicationStatus, string> = {
  [ApplicationStatus.SAVED]: 'border-t-slate-400',
  [ApplicationStatus.APPLIED]: 'border-t-blue-500',
  [ApplicationStatus.INTERVIEW]: 'border-t-amber-500',
  [ApplicationStatus.OFFER]: 'border-t-emerald-500',
  [ApplicationStatus.REJECTED]: 'border-t-rose-500',
};

export default function ApplicationsPage() {
  const { data: board, isLoading } = useApplicationBoard();
  const { hasFeature } = useEntitlements();
  const canSeeAnalytics = hasFeature(PlanFeature.APPLICATION_ANALYTICS);
  const { data: stats } = useApplicationStats(canSeeAnalytics);
  const updateStatus = useUpdateApplicationStatus();
  const deleteApplication = useDeleteApplication();
  const createApplication = useCreateApplication();

  const [showForm, setShowForm] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const totalTracked = board
    ? COLUMN_ORDER.reduce((total, status) => total + (board[status]?.length ?? 0), 0)
    : 0;

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const jobTitle = String(form.get('jobTitle') ?? '').trim();
    const companyName = String(form.get('companyName') ?? '').trim();

    if (!jobTitle || !companyName) {
      setFormError('Job title and company are required.');
      return;
    }

    createApplication.mutate(
      {
        jobTitle,
        companyName,
        jobUrl: String(form.get('jobUrl') ?? '').trim() || undefined,
        status: (form.get('status') as ApplicationStatus) ?? ApplicationStatus.SAVED,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setFormError(null);
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { message?: string } } }).response?.data
            ?.message;
          setFormError(detail ?? 'Could not create the application.');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Briefcase className="h-6 w-6 text-primary" aria-hidden="true" />
            Application tracker
          </h2>
          <p className="text-muted-foreground">
            {totalTracked} tracked {totalTracked === 1 ? 'application' : 'applications'} across five
            stages.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/jobs">Find jobs</Link>
          </Button>
          <Button onClick={() => setShowForm((visible) => !visible)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            Add manually
          </Button>
        </div>
      </header>

      {showForm ? (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Track an application</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input id="jobTitle" name="jobTitle" required placeholder="Frontend Engineer" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Company</Label>
                <Input id="companyName" name="companyName" required placeholder="Acme Inc" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jobUrl">Job URL (optional)</Label>
                <Input id="jobUrl" name="jobUrl" type="url" placeholder="https://" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Stage</Label>
                <Select id="status" name="status" defaultValue={ApplicationStatus.APPLIED}>
                  {COLUMN_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {humanizeEnum(status)}
                    </option>
                  ))}
                </Select>
              </div>
              {formError ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={createApplication.isPending}>
                  Save application
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canSeeAnalytics && stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Applied (30d)', value: stats.appliedLast30Days },
            { label: 'Interview rate', value: formatPercent(stats.interviewRate) },
            { label: 'Offer rate', value: formatPercent(stats.offerRate) },
            {
              label: 'Avg days to interview',
              value: stats.avgDaysToInterview ?? '—',
            },
          ].map((metric) => (
            <Card key={metric.label} className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass-card border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Application analytics — interview and offer conversion rates
            </div>
            <Badge variant="premium" className="gap-1">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Pro feature
            </Badge>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-5">
          {COLUMN_ORDER.map((status) => (
            <Skeleton key={status} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {COLUMN_ORDER.map((status) => {
            const items = board?.[status] ?? [];
            return (
              <section
                key={status}
                aria-label={`${humanizeEnum(status)} (${items.length})`}
                className={`rounded-lg border border-t-4 bg-card/40 p-3 ${COLUMN_STYLES[status]}`}
              >
                <h3 className="mb-3 flex items-center justify-between text-sm font-semibold">
                  {humanizeEnum(status)}
                  <Badge variant="outline">{items.length}</Badge>
                </h3>

                <div className="space-y-2">
                  {items.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      onMove={(nextStatus) =>
                        updateStatus.mutate({ id: application.id, status: nextStatus })
                      }
                      onDelete={() => deleteApplication.mutate(application.id)}
                    />
                  ))}
                  {items.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Nothing here yet</p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  application,
  onMove,
  onDelete,
}: {
  application: Application;
  onMove: (status: ApplicationStatus) => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-md border bg-background p-3 shadow-sm">
      <h4 className="text-sm font-medium leading-tight">{application.jobTitle}</h4>
      <p className="truncate text-xs text-muted-foreground">{application.companyName}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Updated {formatRelativeTime(application.updatedAt)}
      </p>

      <div className="mt-2 flex items-center gap-1">
        <Select
          aria-label={`Move ${application.jobTitle} to another stage`}
          className="h-8 text-xs"
          value={application.status}
          onChange={(event) => onMove(event.target.value as ApplicationStatus)}
        >
          {COLUMN_ORDER.map((status) => (
            <option key={status} value={status}>
              {humanizeEnum(status)}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-2 flex items-center justify-between">
        {application.jobUrl ? (
          <a
            href={application.jobUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={`Delete application for ${application.jobTitle}`}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
