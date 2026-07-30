'use client';

import * as React from 'react';
import Link from 'next/link';
import { BellRing, Bookmark, Briefcase, Calendar, Search, Sparkles } from 'lucide-react';
import { PlanTier } from '@ai-career/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckoutReturnBanner } from '@/components/dashboard/checkout-return-banner';
import { useAuthStore } from '@/stores/auth-store';
import { useEntitlements, useSubscription, useUserSummary } from '@/hooks/use-account';
import { useInfiniteJobs } from '@/hooks/use-jobs';

export default function DashboardOverviewPage() {
  const user = useAuthStore((state) => state.user);
  const { data: summary } = useUserSummary();
  const { data: entitlements, plan } = useEntitlements();
  const { data: subscription } = useSubscription();
  const { data: latestJobs } = useInfiniteJobs({ pageSize: 5 });

  const widgets = [
    {
      label: 'Saved jobs',
      value: summary?.savedJobs ?? 0,
      icon: Bookmark,
      hint:
        entitlements?.limits.maxSavedJobs === null
          ? 'Unlimited on your plan'
          : `Limit ${entitlements?.limits.maxSavedJobs ?? '—'}`,
      href: '/saved-jobs',
    },
    {
      label: 'Applications',
      value: summary?.applications ?? 0,
      icon: Briefcase,
      hint: 'Tracked across five stages',
      href: '/dashboard/applications',
    },
    {
      label: 'Active alerts',
      value: summary?.activeAlerts ?? 0,
      icon: BellRing,
      hint: `${summary?.newMatchesLast7Days ?? 0} notifications this week`,
      href: '/dashboard/alerts',
    },
    {
      label: 'Interviews',
      value: summary?.interviews ?? 0,
      icon: Calendar,
      hint: 'Applications in the interview stage',
      href: '/dashboard/applications',
    },
  ];

  return (
    <div className="space-y-6">
      <React.Suspense fallback={null}>
        <CheckoutReturnBanner />
      </React.Suspense>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]}
          </h2>
          <p className="text-muted-foreground">
            Jobs are collected automatically from Greenhouse, Lever, and RemoteOK.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={plan === PlanTier.FREE ? 'outline' : 'premium'} className="gap-1">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {plan} plan
          </Badge>
          <Button asChild>
            <Link href="/jobs">
              <Search className="mr-1 h-4 w-4" aria-hidden="true" />
              Find jobs
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.map((widget) => (
          <Link key={widget.label} href={widget.href} className="block">
            <Card className="glass-card h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {widget.label}
                </CardTitle>
                <widget.icon className="h-4 w-4 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{widget.value}</div>
                <p className="text-xs text-muted-foreground">{widget.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Latest jobs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/jobs">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(latestJobs?.pages[0]?.items ?? []).map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.slug}`}
                className="block rounded-md p-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">{job.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {job.company?.name ?? 'Unknown company'} ·{' '}
                  {job.isRemote ? 'Remote' : (job.location ?? 'Not specified')}
                </span>
              </Link>
            ))}
            {(latestJobs?.pages[0]?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No jobs ingested yet — run a scrape from the admin panel or wait for the next cron.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Account status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Email verification:{' '}
              <span className={user?.isEmailVerified ? 'text-green-500' : 'text-amber-500'}>
                {user?.isEmailVerified ? 'Verified' : 'Pending — check your inbox'}
              </span>
            </p>
            <p className="text-muted-foreground">
              Member since{' '}
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </p>
            <p>
              Plan: <span className="font-medium">{plan}</span>
              {plan !== PlanTier.FREE && subscription?.currentPeriodEnd ? (
                <span className="text-muted-foreground">
                  {subscription.cancelAtPeriodEnd
                    ? ` — ends ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : ` — renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                </span>
              ) : null}
            </p>
            {plan === PlanTier.FREE ? (
              <p className="pt-2">
                <Link href="/pricing" className="text-primary underline">
                  Upgrade
                </Link>{' '}
                for early job access, advanced filters, and unlimited alerts.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
