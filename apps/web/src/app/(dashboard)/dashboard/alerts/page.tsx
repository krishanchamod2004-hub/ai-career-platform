'use client';

import * as React from 'react';
import { BellRing, Lock, Plus, Trash2 } from 'lucide-react';
import {
  AlertFrequency,
  ExperienceLevel,
  JobType,
  NotificationChannel,
  PlanFeature,
  type JobAlert,
} from '@ai-career/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateJobAlert,
  useDeleteJobAlert,
  useEntitlements,
  useJobAlerts,
  useUpdateJobAlert,
} from '@/hooks/use-account';
import { formatRelativeTime, humanizeEnum } from '@/lib/format';

export default function JobAlertsPage() {
  const { data: alerts, isLoading } = useJobAlerts();
  const { data: entitlements, hasFeature } = useEntitlements();
  const createAlert = useCreateJobAlert();
  const updateAlert = useUpdateJobAlert();
  const deleteAlert = useDeleteJobAlert();

  const canUseInstant = hasFeature(PlanFeature.INSTANT_ALERTS);
  const limit = entitlements?.limits.maxJobAlerts ?? null;
  const used = alerts?.length ?? 0;
  const atLimit = limit !== null && used >= limit;

  const [showForm, setShowForm] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const keywords = String(form.get('keywords') ?? '')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const locations = String(form.get('locations') ?? '')
      .split(',')
      .map((location) => location.trim())
      .filter(Boolean);

    createAlert.mutate(
      {
        name: String(form.get('name') ?? '').trim(),
        keywords,
        locations,
        jobTypes: form.get('jobType') ? [form.get('jobType') as JobType] : undefined,
        experienceLevels: form.get('experienceLevel')
          ? [form.get('experienceLevel') as ExperienceLevel]
          : undefined,
        salaryMin: form.get('salaryMin') ? Number(form.get('salaryMin')) : undefined,
        isRemoteOnly: form.get('isRemoteOnly') === 'on',
        frequency: (form.get('frequency') as AlertFrequency) ?? AlertFrequency.DAILY,
        channels: [
          NotificationChannel.IN_APP,
          ...(form.get('emailChannel') === 'on' ? [NotificationChannel.EMAIL] : []),
        ],
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setFormError(null);
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { message?: string } } }).response?.data
            ?.message;
          setFormError(detail ?? 'Could not create the alert.');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BellRing className="h-6 w-6 text-primary" aria-hidden="true" />
            Job alerts
          </h2>
          <p className="text-muted-foreground">
            Saved searches that notify you when matching jobs are ingested.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={atLimit ? 'warning' : 'outline'}>
            {limit === null ? `${used} alerts · unlimited` : `${used} / ${limit} used`}
          </Badge>
          <Button onClick={() => setShowForm((visible) => !visible)} disabled={atLimit}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            New alert
          </Button>
        </div>
      </header>

      {atLimit ? (
        <Card className="glass-card border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span>You have reached your plan&apos;s alert limit.</span>
            <Badge variant="premium" className="gap-1">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Upgrade for more
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Create a job alert</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Alert name</Label>
                <Input id="name" name="name" required placeholder="Senior React roles in Europe" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="keywords">Keywords (comma separated)</Label>
                <Input id="keywords" name="keywords" placeholder="react, frontend" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="locations">Locations (comma separated)</Label>
                <Input id="locations" name="locations" placeholder="Berlin, Remote" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="jobType">Job type</Label>
                <Select id="jobType" name="jobType" defaultValue="">
                  <option value="">Any</option>
                  {Object.values(JobType).map((type) => (
                    <option key={type} value={type}>
                      {humanizeEnum(type)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="experienceLevel">Experience</Label>
                <Select id="experienceLevel" name="experienceLevel" defaultValue="">
                  <option value="">Any</option>
                  {Object.values(ExperienceLevel).map((level) => (
                    <option key={level} value={level}>
                      {humanizeEnum(level)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="salaryMin">Minimum salary (yearly)</Label>
                <Input id="salaryMin" name="salaryMin" type="number" min={0} step={5000} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="frequency">Frequency</Label>
                <Select id="frequency" name="frequency" defaultValue={AlertFrequency.DAILY}>
                  <option value={AlertFrequency.DAILY}>Daily digest</option>
                  <option value={AlertFrequency.WEEKLY}>Weekly digest</option>
                  <option value={AlertFrequency.INSTANT} disabled={!canUseInstant}>
                    Instant {canUseInstant ? '' : '(Premium)'}
                  </option>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <CheckboxField name="isRemoteOnly" label="Remote roles only" />
                <CheckboxField
                  name="emailChannel"
                  label="Also send email notifications"
                  defaultChecked
                />
              </div>

              {formError ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={createAlert.isPending}>
                  Create alert
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (alerts?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No alerts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one and the scraper will notify you as soon as a match is ingested.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts?.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onToggle={(isActive) =>
                updateAlert.mutate({ id: alert.id, payload: { isActive } })
              }
              onDelete={() => deleteAlert.mutate(alert.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  onToggle,
  onDelete,
}: {
  alert: JobAlert;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  const criteria = [
    ...(alert.keywords ?? []),
    ...(alert.locations ?? []),
    ...(alert.skills ?? []),
    ...(alert.isRemoteOnly ? ['Remote only'] : []),
    ...(alert.salaryMin ? [`From $${alert.salaryMin.toLocaleString()}`] : []),
  ];

  return (
    <Card className="glass-card">
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{alert.name}</h3>
            <Badge variant={alert.isActive ? 'success' : 'outline'}>
              {alert.isActive ? 'Active' : 'Paused'}
            </Badge>
            <Badge variant="outline">{humanizeEnum(alert.frequency)}</Badge>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {criteria.length > 0 ? (
              criteria.map((entry) => (
                <Badge key={entry} variant="secondary">
                  {entry}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No filters</span>
            )}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {alert.matchCount} matches ·{' '}
            {alert.lastSentAt ? `last sent ${formatRelativeTime(alert.lastSentAt)}` : 'never sent'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onToggle(!alert.isActive)}>
            {alert.isActive ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete alert ${alert.name}`}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
