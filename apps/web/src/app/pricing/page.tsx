'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Check, Loader2, Sparkles } from 'lucide-react';
import { PlanTier, type PlanDefinition } from '@ai-career/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SiteHeader } from '@/components/site-header';
import { useCreateCheckout, useEntitlements, usePlans, useSubscription } from '@/hooks/use-account';
import { getApiErrorMessage } from '@/hooks/use-evaluations';
import { useAuthStore } from '@/stores/auth-store';

/** Plan ordering, used to label a cheaper tier as a downgrade rather than "Upgrade". */
const TIER_RANK: Record<PlanTier, number> = {
  [PlanTier.FREE]: 0,
  [PlanTier.PRO]: 1,
  [PlanTier.PREMIUM]: 2,
};

/**
 * Pricing page rendered from the API's plan catalog, so the limits shown here can
 * never drift from the limits enforced server-side.
 *
 * Checkout goes through POST /billing/checkout, which returns a hosted Lemon
 * Squeezy URL. The plan is NOT updated optimistically on return: only the signed
 * webhook moves a subscription, so the success banner polls entitlements instead
 * of trusting the redirect it was handed.
 */
export default function PricingPage() {
  // useSearchParams requires a Suspense boundary during prerendering.
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 py-12">
            <div className="grid gap-6 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-80" />
              ))}
            </div>
          </main>
        </div>
      }
    >
      <PricingContent />
    </React.Suspense>
  );
}

function PricingContent() {
  const { data: plans, isLoading } = usePlans();
  const user = useAuthStore((state) => state.user);
  const { plan: currentPlan } = useEntitlements();
  const { data: subscription } = useSubscription();
  const checkout = useCreateCheckout();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pendingTier, setPendingTier] = React.useState<PlanTier | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const justReturned = searchParams.get('checkout') === 'success';

  const startCheckout = (tier: PlanTier) => {
    setError(null);

    if (!user) {
      // Send them back here after logging in so the intent is not lost.
      router.push(`/login?redirect=${encodeURIComponent('/pricing')}`);
      return;
    }

    setPendingTier(tier);
    checkout.mutate(
      { plan: tier, redirectPath: '/dashboard?checkout=success' },
      {
        onSuccess: (session) => {
          // Full-page navigation: the destination is the provider's domain.
          window.location.assign(session.url);
        },
        onError: (mutationError) => {
          setPendingTier(null);
          setError(
            getApiErrorMessage(
              mutationError,
              'Could not start checkout. Please try again in a moment.',
            ),
          );
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
          <p className="mt-2 text-muted-foreground">
            Upgrade for earlier access to new listings, advanced filters, and company intelligence.
          </p>
        </header>

        {justReturned ? (
          <div
            role="status"
            className="mb-8 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm"
          >
            Payment received. Your plan updates as soon as the provider confirms the subscription —
            usually within a few seconds. Check{' '}
            <Link href="/dashboard" className="text-primary underline">
              your dashboard
            </Link>{' '}
            for the current status.
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mb-8 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-80" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans?.map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                currentPlan={user ? currentPlan : null}
                isPending={pendingTier === plan.tier}
                isDisabled={pendingTier !== null}
                onSelect={startCheckout}
              />
            ))}
          </div>
        )}

        <div className="mt-8 space-y-2 text-center text-sm text-muted-foreground">
          {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd ? (
            <p>
              Your {currentPlan} plan is set to cancel on{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. You keep every paid
              feature until then.
            </p>
          ) : null}
          <p>
            Payments and invoices are handled by Lemon Squeezy. Manage or cancel a subscription from
            the receipt email they send you — cancelling keeps your plan until the end of the period
            you have already paid for.
          </p>
        </div>
      </main>
    </div>
  );
}

function PlanCard({
  plan,
  currentPlan,
  isPending,
  isDisabled,
  onSelect,
}: {
  plan: PlanDefinition;
  currentPlan: PlanTier | null;
  isPending: boolean;
  isDisabled: boolean;
  onSelect: (tier: PlanTier) => void;
}) {
  const isCurrent = currentPlan === plan.tier;
  const isFeatured = plan.tier === PlanTier.PRO;
  const isFree = plan.tier === PlanTier.FREE;
  const isDowngrade = currentPlan !== null && TIER_RANK[plan.tier] < TIER_RANK[currentPlan];

  return (
    <Card className={isFeatured ? 'glass-card border-primary/60 shadow-lg' : 'glass-card'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.name}</CardTitle>
          {isCurrent ? (
            <Badge variant="success">Current</Badge>
          ) : isFeatured ? (
            <Badge variant="premium" className="gap-1">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Popular
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <p>
          <span className="text-3xl font-bold">${plan.monthlyPriceUsd}</span>
          <span className="text-sm text-muted-foreground">/month</span>
        </p>

        <ul className="space-y-2 text-sm">
          {plan.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {highlight}
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <dt>Saved jobs</dt>
            <dd>{plan.limits.maxSavedJobs ?? 'Unlimited'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Job alerts</dt>
            <dd>{plan.limits.maxJobAlerts ?? 'Unlimited'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Early job access</dt>
            <dd>
              {plan.limits.earlyAccessHours > 0
                ? `${plan.limits.earlyAccessHours}h head start`
                : 'Not included'}
            </dd>
          </div>
        </dl>

        <PlanCta
          plan={plan}
          isCurrent={isCurrent}
          isFree={isFree}
          isFeatured={isFeatured}
          isDowngrade={isDowngrade}
          isPending={isPending}
          isDisabled={isDisabled}
          onSelect={onSelect}
        />
      </CardContent>
    </Card>
  );
}

function PlanCta({
  plan,
  isCurrent,
  isFree,
  isFeatured,
  isDowngrade,
  isPending,
  isDisabled,
  onSelect,
}: {
  plan: PlanDefinition;
  isCurrent: boolean;
  isFree: boolean;
  isFeatured: boolean;
  isDowngrade: boolean;
  isPending: boolean;
  isDisabled: boolean;
  onSelect: (tier: PlanTier) => void;
}) {
  if (isCurrent) {
    return (
      <Button className="w-full" variant="outline" disabled>
        Your current plan
      </Button>
    );
  }

  // FREE is what every account starts on, so there is nothing to buy. Moving down
  // a tier is a cancellation, which the provider owns — pretending otherwise here
  // would imply we can refund or prorate, which this integration does not do.
  if (isFree || isDowngrade) {
    return (
      <Button className="w-full" variant="outline" disabled>
        {isFree ? 'Included with every account' : 'Cancel from your receipt email'}
      </Button>
    );
  }

  return (
    <Button
      className="w-full"
      variant={isFeatured ? 'default' : 'outline'}
      disabled={isDisabled}
      onClick={() => onSelect(plan.tier)}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Opening checkout
        </>
      ) : (
        `Upgrade to ${plan.name}`
      )}
    </Button>
  );
}
