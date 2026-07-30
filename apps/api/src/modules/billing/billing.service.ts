import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  getPlanLimits,
  PLAN_CATALOG,
  PlanFeature,
  PlanTier,
  SubscriptionStatus,
  type Entitlements,
  type PlanDefinition,
  type PlanLimits,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';

type LimitKey = 'maxSavedJobs' | 'maxJobAlerts' | 'maxApplications' | 'maxResumes' | 'maxAtsChecksPerMonth';

/**
 * Single source of truth for "what is this user allowed to do".
 *
 * Phase 2 ships the subscription architecture without a payment provider: plan
 * changes happen through the admin API (or seeding). When Stripe is added later,
 * only `syncFromProvider`-style methods need to exist — every entitlement check
 * in the codebase already goes through this service.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  getPlanCatalog(): PlanDefinition[] {
    return PLAN_CATALOG;
  }

  /** Returns the subscription row, creating a FREE one on first access. */
  async getOrCreateSubscription(userId: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existing) {
      return existing;
    }
    return this.prisma.subscription.create({
      data: { userId, plan: PlanTier.FREE, status: SubscriptionStatus.ACTIVE },
    });
  }

  /**
   * Effective plan: a subscription that is canceled, expired, past due, or whose
   * paid period has elapsed degrades to FREE rather than silently keeping perks.
   */
  async getEffectivePlan(userId: string): Promise<PlanTier> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });

    if (!subscription) {
      return PlanTier.FREE;
    }

    const activeStatuses: SubscriptionStatus[] = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
    ];
    if (!activeStatuses.includes(subscription.status as SubscriptionStatus)) {
      return PlanTier.FREE;
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < Date.now()) {
      return PlanTier.FREE;
    }
    return subscription.plan as PlanTier;
  }

  async getLimits(userId: string): Promise<PlanLimits> {
    return getPlanLimits(await this.getEffectivePlan(userId));
  }

  async hasFeature(userId: string, feature: PlanFeature): Promise<boolean> {
    const limits = await this.getLimits(userId);
    return limits.features.includes(feature);
  }

  async assertFeature(userId: string, feature: PlanFeature): Promise<void> {
    if (!(await this.hasFeature(userId, feature))) {
      throw new ForbiddenException({
        message: `Your plan does not include ${feature}. Upgrade to unlock it.`,
        error: 'PLAN_UPGRADE_REQUIRED',
        feature,
      });
    }
  }

  async getEntitlements(userId: string): Promise<Entitlements> {
    const subscription = await this.getOrCreateSubscription(userId);
    const plan = await this.getEffectivePlan(userId);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [savedJobs, jobAlerts, applications, resumes, atsChecksThisMonth] = await Promise.all([
      this.prisma.savedJob.count({ where: { userId } }),
      this.prisma.jobAlert.count({ where: { userId } }),
      this.prisma.application.count({ where: { userId } }),
      this.prisma.resume.count({ where: { userId } }),
      this.prisma.atsScore.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    ]);

    return {
      plan,
      status: subscription.status as SubscriptionStatus,
      limits: getPlanLimits(plan),
      usage: { savedJobs, jobAlerts, applications, resumes, atsChecksThisMonth },
    };
  }

  /**
   * Throws when the user is at their plan's cap for a countable resource.
   * `null` limits mean unlimited.
   */
  async assertWithinLimit(userId: string, key: LimitKey, currentCount: number): Promise<void> {
    const limits = await this.getLimits(userId);
    const max = limits[key];
    if (max !== null && currentCount >= max) {
      throw new ForbiddenException({
        message: `Plan limit reached (${max}). Upgrade your plan to add more.`,
        error: 'PLAN_LIMIT_REACHED',
        limit: key,
        max,
      });
    }
  }

  /** Hours new jobs stay exclusive to this user's plan (0 = no early access). */
  async getEarlyAccessHours(userId: string | null): Promise<number> {
    if (!userId) {
      return 0;
    }
    const limits = await this.getLimits(userId);
    return limits.features.includes(PlanFeature.EARLY_JOB_ACCESS) ? limits.earlyAccessHours : 0;
  }

  /**
   * Administrative plan change. This is the seam a billing webhook would call
   * once a provider is connected.
   */
  async setPlan(
    userId: string,
    plan: PlanTier,
    options: { status?: SubscriptionStatus; periodDays?: number } = {},
  ) {
    const status = options.status ?? SubscriptionStatus.ACTIVE;
    const now = new Date();
    const currentPeriodEnd =
      plan === PlanTier.FREE
        ? null
        : new Date(now.getTime() + (options.periodDays ?? 30) * 24 * 60 * 60 * 1000);

    this.logger.log(`Setting plan for user ${userId} to ${plan} (${status})`);

    return this.prisma.subscription.upsert({
      where: { userId },
      update: { plan, status, currentPeriodStart: now, currentPeriodEnd, cancelAtPeriodEnd: false },
      create: { userId, plan, status, currentPeriodStart: now, currentPeriodEnd },
    });
  }

  /**
   * Applies state reported by a payment provider's webhook.
   *
   * Distinct from `setPlan` (the admin grant) because the provider is the source
   * of truth here: the period window, cancellation flag, and external ids all
   * come from the vendor rather than being computed from `periodDays`. Both write
   * the same `Subscription` row, so every entitlement check is unchanged.
   */
  async applyProviderSubscription(params: {
    userId: string;
    plan: PlanTier;
    status: SubscriptionStatus;
    provider: string;
    externalCustomerId?: string | null;
    externalSubscriptionId?: string | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    trialEndsAt?: Date | null;
  }) {
    const {
      userId,
      plan,
      status,
      provider,
      externalCustomerId = null,
      externalSubscriptionId = null,
      currentPeriodStart = null,
      currentPeriodEnd = null,
      cancelAtPeriodEnd = false,
      trialEndsAt = null,
    } = params;

    this.logger.log(
      `Provider ${provider} set user ${userId} to ${plan} (${status})` +
        `${currentPeriodEnd ? `, period ends ${currentPeriodEnd.toISOString()}` : ''}`,
    );

    const data = {
      plan,
      status,
      provider,
      externalCustomerId,
      externalSubscriptionId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      trialEndsAt,
    };

    return this.prisma.subscription.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }
}
