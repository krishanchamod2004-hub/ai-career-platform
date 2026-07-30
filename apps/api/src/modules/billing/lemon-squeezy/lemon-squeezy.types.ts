import { SubscriptionStatus } from '@ai-career/shared';

/**
 * The subset of the Lemon Squeezy webhook payload this integration relies on.
 * Deliberately narrow — every field the mapper reads is declared here, so an
 * upstream payload change surfaces as a type error rather than `undefined`
 * silently becoming a plan downgrade.
 *
 * Shape reference: https://docs.lemonsqueezy.com/help/webhooks
 */
export interface LemonSqueezyWebhookPayload {
  meta?: {
    event_name?: string;
    test_mode?: boolean;
    /** Whatever we passed as `checkoutData.custom` when creating the checkout. */
    custom_data?: Record<string, unknown>;
  };
  data?: {
    id?: string;
    type?: string;
    attributes?: LemonSqueezySubscriptionAttributes;
  };
}

export interface LemonSqueezySubscriptionAttributes {
  store_id?: number;
  customer_id?: number;
  order_id?: number;
  product_id?: number;
  variant_id?: number;
  user_email?: string;
  status?: string;
  cancelled?: boolean;
  /** ISO timestamp of the next renewal — our `currentPeriodEnd` while active. */
  renews_at?: string | null;
  /** ISO timestamp access actually lapses, set once cancelled. */
  ends_at?: string | null;
  trial_ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Lemon Squeezy subscription statuses we act on.
 *
 * `cancelled` is the subtle one: it means "will not renew", NOT "access revoked".
 * The customer keeps the tier until `ends_at`, so it is mapped to an ACTIVE row
 * with `cancelAtPeriodEnd` set and `currentPeriodEnd = ends_at`, which lets the
 * existing `BillingService.getEffectivePlan()` period check expire it naturally.
 * Mapping it straight to CANCELED would revoke a paid period the customer has
 * already been charged for.
 */
export const LEMON_SQUEEZY_STATUS: Record<string, SubscriptionStatus> = {
  active: SubscriptionStatus.ACTIVE,
  on_trial: SubscriptionStatus.TRIALING,
  past_due: SubscriptionStatus.PAST_DUE,
  cancelled: SubscriptionStatus.ACTIVE,
  unpaid: SubscriptionStatus.PAST_DUE,
  // A paused subscription is not being billed, so it grants nothing.
  paused: SubscriptionStatus.EXPIRED,
  expired: SubscriptionStatus.EXPIRED,
};

export const LEMON_SQUEEZY_PROVIDER = 'lemonsqueezy';

/** Events this integration handles; anything else is acknowledged and ignored. */
export const HANDLED_EVENTS = [
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_resumed',
] as const;
