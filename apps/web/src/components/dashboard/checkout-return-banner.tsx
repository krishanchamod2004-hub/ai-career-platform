'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAwaitPlanUpgrade } from '@/hooks/use-account';

/**
 * Shown when Lemon Squeezy redirects the browser back after a successful payment
 * (`/dashboard?checkout=success`).
 *
 * The query parameter is treated as a hint, never as proof of purchase — anyone can
 * type it. The banner polls `GET /billing/entitlements` and only claims the upgrade
 * once the server reports the new plan, which happens when the signed webhook is
 * processed. If the webhook is slow or was never delivered, the banner says so
 * instead of showing a success state the account does not actually have.
 */
export function CheckoutReturnBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isReturn = searchParams.get('checkout') === 'success';
  const { plan, upgraded, pending, exhausted } = useAwaitPlanUpgrade(isReturn);

  if (!isReturn) {
    return null;
  }

  const dismiss = () => router.replace('/dashboard');

  if (upgraded) {
    return (
      <Banner tone="success" icon={CheckCircle2} onDismiss={dismiss}>
        <span className="font-medium">You are on the {plan} plan.</span> Early access, advanced
        filters, and your new limits are active now.
      </Banner>
    );
  }

  if (exhausted) {
    return (
      <Banner tone="warning" icon={AlertTriangle} onDismiss={dismiss}>
        <span className="font-medium">Payment received, plan not applied yet.</span> The provider
        confirmation has not arrived. Reload in a minute — if your plan still has not changed,
        contact support with your Lemon Squeezy receipt.
      </Banner>
    );
  }

  return (
    <Banner tone="info" icon={Loader2} spin={pending} onDismiss={dismiss}>
      Confirming your subscription with the payment provider. This usually takes a few seconds.
    </Banner>
  );
}

const TONE_CLASSES = {
  success: 'border-primary/40 bg-primary/5',
  warning: 'border-amber-500/40 bg-amber-500/5',
  info: 'border-border bg-muted/40',
} as const;

const ICON_CLASSES = {
  success: 'text-primary',
  warning: 'text-amber-500',
  info: 'text-muted-foreground',
} as const;

function Banner({
  tone,
  icon: Icon,
  spin = false,
  onDismiss,
  children,
}: {
  tone: keyof typeof TONE_CLASSES;
  icon: LucideIcon;
  spin?: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${TONE_CLASSES[tone]}`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_CLASSES[tone]} ${spin ? 'animate-spin' : ''}`}
        aria-hidden
      />
      <p className="flex-1">{children}</p>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
