'use client';

import * as React from 'react';
import { AlertTriangle, Database, Play, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { UserRole } from '@ai-career/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/services/admin-api';
import { useAuthStore } from '@/stores/auth-store';
import { formatPercent, formatRelativeTime, humanizeEnum } from '@/lib/format';

/**
 * Admin foundation UI: platform metrics, scraper health, failed runs, queue depth,
 * and system logs. Server-side every endpoint is @Roles(ADMIN) guarded; this only
 * hides the navigation for non-admins.
 */
export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.ADMIN;

  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: adminApi.overview, enabled: isAdmin });
  const summary = useQuery({ queryKey: ['admin', 'summary'], queryFn: adminApi.summary, enabled: isAdmin });
  const status = useQuery({
    queryKey: ['admin', 'scraper-status'],
    queryFn: adminApi.scraperStatus,
    enabled: isAdmin,
    refetchInterval: 30_000,
  });
  const failures = useQuery({
    queryKey: ['admin', 'failed-runs'],
    queryFn: () => adminApi.failedRuns({ page: 1 }),
    enabled: isAdmin,
  });
  const queues = useQuery({
    queryKey: ['admin', 'queues'],
    queryFn: adminApi.queues,
    enabled: isAdmin,
    refetchInterval: 15_000,
  });
  const logs = useQuery({
    queryKey: ['admin', 'logs'],
    queryFn: () => adminApi.logs({ page: 1, channel: 'scraper' }),
    enabled: isAdmin,
  });

  const [busySourceId, setBusySourceId] = React.useState<string | null>(null);

  if (!isAdmin) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center gap-3 p-6">
          <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Admin access required</p>
            <p className="text-sm text-muted-foreground">
              Your account does not have the ADMIN role.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const triggerSource = async (sourceId: string) => {
    setBusySourceId(sourceId);
    try {
      await adminApi.triggerSource(sourceId);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    } finally {
      setBusySourceId(null);
    }
  };

  const metrics = [
    { label: 'Total jobs', value: overview.data?.totalJobs, icon: Database },
    { label: 'New jobs today', value: overview.data?.newJobsToday, icon: Database },
    { label: 'Active users (7d)', value: overview.data?.activeUsers7Days, icon: Users },
    { label: 'Failed runs (24h)', value: summary.data?.failedRuns24h, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Admin</h2>
        <p className="text-muted-foreground">
          Platform analytics, ingestion health, and system logs.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {metric.value === undefined ? '—' : metric.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Scraper sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            (status.data ?? []).map((health) => (
              <div
                key={health.source.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{health.source.name}</span>
                    <Badge variant="outline">{health.source.type}</Badge>
                    <Badge variant={health.source.isEnabled ? 'success' : 'outline'}>
                      {health.source.isEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {health.isHealthy ? null : <Badge variant="destructive">Unhealthy</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    cron {health.source.cronExpression} · last run{' '}
                    {health.source.lastRunAt ? formatRelativeTime(health.source.lastRunAt) : 'never'}{' '}
                    · 24h success {formatPercent(health.successRate24h)} · {health.jobsIngested24h}{' '}
                    jobs ingested
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busySourceId === health.source.id}
                    onClick={() => void triggerSource(health.source.id)}
                  >
                    <Play className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Run now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await adminApi.toggleSource(health.source.id, !health.source.isEnabled);
                      await queryClient.invalidateQueries({ queryKey: ['admin'] });
                    }}
                  >
                    {health.source.isEnabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Queues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(queues.data ?? []).map((queue) => (
              <div key={queue.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{queue.name}</span>
                <span className="text-muted-foreground">
                  {queue.waiting} waiting · {queue.active} active · {queue.failed} failed
                </span>
              </div>
            ))}
            {queues.isLoading ? <Skeleton className="h-16" /> : null}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Failed scraper runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(failures.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures recorded.</p>
            ) : (
              failures.data?.items.map((run) => (
                <div key={run.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{run.sourceSlug ?? run.sourceId}</p>
                    <p className="truncate text-xs text-destructive">{run.errorMessage}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(run.startedAt)} · attempt {run.attempt}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await adminApi.retryRun(run.id);
                      await queryClient.invalidateQueries({ queryKey: ['admin'] });
                    }}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Retry
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Recent scraper logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <ul className="space-y-2 text-sm">
              {logs.data?.items.map((log) => (
                <li key={log.id} className="flex items-start gap-2">
                  <Badge
                    variant={
                      log.level === 'ERROR'
                        ? 'destructive'
                        : log.level === 'WARN'
                          ? 'warning'
                          : 'outline'
                    }
                  >
                    {humanizeEnum(log.level)}
                  </Badge>
                  <span className="min-w-0 flex-1">{log.message}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </li>
              ))}
              {logs.data?.items.length === 0 ? (
                <li className="text-muted-foreground">No logs yet.</li>
              ) : null}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
