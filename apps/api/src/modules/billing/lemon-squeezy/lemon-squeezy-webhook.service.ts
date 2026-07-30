import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionStatus } from '@ai-career/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing.service';
import { LemonSqueezyConfig } from './lemon-squeezy.config';
import {
  HANDLED_EVENTS,
  LEMON_SQUEEZY_PROVIDER,
  LEMON_SQUEEZY_STATUS,
  type LemonSqueezySubscriptionAttributes,
  type LemonSqueezyWebhookPayload,
} from './lemon-squeezy.types';

export type WebhookOutcome =
  | 'applied'
  | 'duplicate'
  | 'ignored_event'
  | 'unknown_variant'
  | 'unknown_status'
  | 'unattributed';

export interface WebhookResult {
  outcome: WebhookOutcome;
  eventName: string;
}

/**
 * Translates verified Lemon Squeezy subscription events into `Subscription` rows.
 *
 * Everything funnels through `BillingService.applyProviderSubscription`, so the
 * entitlement path (PlanFeatureGuard, assertWithinLimit, early access) needs no
 * knowledge that a payment provider exists.
 */
@Injectable()
export class LemonSqueezyWebhookService {
  private readonly logger = new Logger(LemonSqueezyWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly lsConfig: LemonSqueezyConfig,
  ) {}

  /**
   * `rawBody` is hashed as the idempotency key, so it must be the same bytes the
   * signature was verified against.
   */
  async process(rawBody: Buffer, payload: LemonSqueezyWebhookPayload): Promise<WebhookResult> {
    const eventName = payload.meta?.event_name ?? 'unknown';
    const eventId = createHash('sha256').update(rawBody).digest('hex');
    const attributes = payload.data?.attributes ?? {};
    const externalSubscriptionId = payload.data?.id ? String(payload.data.id) : null;

    const alreadyProcessed = await this.prisma.billingWebhookEvent.findUnique({
      where: { provider_eventId: { provider: LEMON_SQUEEZY_PROVIDER, eventId } },
      select: { id: true },
    });
    if (alreadyProcessed) {
      this.logger.log(`Ignoring duplicate ${eventName} webhook (${eventId.slice(0, 12)})`);
      return { outcome: 'duplicate', eventName };
    }

    if (!HANDLED_EVENTS.includes(eventName as (typeof HANDLED_EVENTS)[number])) {
      // Acknowledged so Lemon Squeezy stops retrying, but recorded so the
      // ledger shows what arrived.
      await this.record(eventId, eventName, externalSubscriptionId);
      return { outcome: 'ignored_event', eventName };
    }

    const plan = this.lsConfig.getPlanForVariant(attributes.variant_id);
    if (!plan) {
      // A different product in the same store, or a variant id that was never
      // configured. Guessing a tier here would let any purchase grant access.
      this.logger.warn(
        `${eventName}: variant ${attributes.variant_id} is not mapped to a plan — ignoring.`,
      );
      await this.record(eventId, eventName, externalSubscriptionId);
      return { outcome: 'unknown_variant', eventName };
    }

    const status = this.mapStatus(attributes.status);
    if (!status) {
      // Neither grant nor revoke on an unrecognized status: both directions are
      // wrong answers, and a retry after a fix is preferable. Not recorded, so
      // the delivery can be replayed once the mapping is updated.
      this.logger.error(
        `${eventName}: unrecognized Lemon Squeezy status "${attributes.status}" — leaving plan unchanged.`,
      );
      return { outcome: 'unknown_status', eventName };
    }

    const userId = await this.resolveUserId(payload, externalSubscriptionId, attributes);
    if (!userId) {
      this.logger.error(
        `${eventName}: could not attribute subscription ${externalSubscriptionId} to a user — ignoring.`,
      );
      await this.record(eventId, eventName, externalSubscriptionId);
      return { outcome: 'unattributed', eventName };
    }

    const isCancelled = attributes.status === 'cancelled' || attributes.cancelled === true;
    // While active, the paid period runs to `renews_at`; once cancelled, access
    // ends at `ends_at`. getEffectivePlan() compares this against now, so a
    // cancelled-but-paid subscription keeps its tier until the date passes.
    const periodEnd = isCancelled
      ? (this.toDate(attributes.ends_at) ?? this.toDate(attributes.renews_at))
      : this.toDate(attributes.renews_at);

    await this.billing.applyProviderSubscription({
      userId,
      plan,
      status,
      provider: LEMON_SQUEEZY_PROVIDER,
      externalCustomerId: attributes.customer_id ? String(attributes.customer_id) : null,
      externalSubscriptionId,
      currentPeriodStart: this.toDate(attributes.created_at),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: isCancelled,
      trialEndsAt: this.toDate(attributes.trial_ends_at),
    });

    await this.record(eventId, eventName, externalSubscriptionId);
    this.logger.log(
      `${eventName}: user ${userId} -> ${plan} (${status})${isCancelled ? ', cancels at period end' : ''}`,
    );
    return { outcome: 'applied', eventName };
  }

  private mapStatus(lsStatus: string | undefined): SubscriptionStatus | undefined {
    if (!lsStatus) {
      return undefined;
    }
    return LEMON_SQUEEZY_STATUS[lsStatus];
  }

  /**
   * Attribution order, most to least trustworthy:
   *  1. `meta.custom_data.user_id` — what we put in the checkout ourselves.
   *  2. An existing row already bound to this provider subscription id (renewals
   *     and cancellations do not carry our custom data).
   *  3. The billing email, as a last resort for checkouts created outside the app
   *     (e.g. a manual link from the Lemon Squeezy dashboard).
   */
  private async resolveUserId(
    payload: LemonSqueezyWebhookPayload,
    externalSubscriptionId: string | null,
    attributes: LemonSqueezySubscriptionAttributes,
  ): Promise<string | null> {
    const custom = payload.meta?.custom_data ?? {};
    const fromCustom = custom.user_id;
    if (typeof fromCustom === 'string' && fromCustom.length > 0) {
      const exists = await this.prisma.user.findUnique({
        where: { id: fromCustom },
        select: { id: true },
      });
      if (exists) {
        return exists.id;
      }
      this.logger.warn(`custom_data.user_id ${fromCustom} does not match a user.`);
    }

    if (externalSubscriptionId) {
      const bound = await this.prisma.subscription.findFirst({
        where: { externalSubscriptionId, provider: LEMON_SQUEEZY_PROVIDER },
        select: { userId: true },
      });
      if (bound) {
        return bound.userId;
      }
    }

    if (attributes.user_email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: attributes.user_email.toLowerCase() },
        select: { id: true },
      });
      if (byEmail) {
        return byEmail.id;
      }
    }

    return null;
  }

  private toDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async record(
    eventId: string,
    eventName: string,
    externalSubscriptionId: string | null,
  ): Promise<void> {
    // Concurrent retries can race between the findUnique above and this write;
    // the unique constraint is the real guard, so a duplicate insert is benign.
    await this.prisma.billingWebhookEvent
      .create({
        data: { provider: LEMON_SQUEEZY_PROVIDER, eventId, eventName, externalSubscriptionId },
      })
      .catch(() => undefined);
  }
}
