import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanTier } from '@ai-career/shared';

/**
 * Typed access to the Lemon Squeezy environment, plus the variant <-> plan map.
 *
 * Nothing here throws at construction time: the API must still boot (and serve
 * jobs, auth, evaluations) on a deployment that has not connected billing yet.
 * Instead `isConfigured` is false and the checkout endpoint returns 503, while
 * the webhook returns 503 rather than pretending to have accepted an event.
 */
@Injectable()
export class LemonSqueezyConfig {
  private readonly logger = new Logger(LemonSqueezyConfig.name);

  readonly apiKey: string;
  readonly storeId: string;
  readonly webhookSecret: string;
  /** PlanTier -> Lemon Squeezy variant id (only tiers with a configured id). */
  private readonly variantByPlan = new Map<PlanTier, string>();
  /** Reverse map, used by the webhook to resolve a purchased variant to a tier. */
  private readonly planByVariant = new Map<string, PlanTier>();

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('LEMON_SQUEEZY_API_KEY', '').trim();
    this.storeId = this.config.get<string>('LEMON_SQUEEZY_STORE_ID', '').trim();
    this.webhookSecret = this.config.get<string>('LEMON_SQUEEZY_WEBHOOK_SECRET', '').trim();

    const proVariant = this.config.get<string>('LEMON_SQUEEZY_VARIANT_ID_PRO', '').trim();
    const premiumVariant = this.config.get<string>('LEMON_SQUEEZY_VARIANT_ID_PREMIUM', '').trim();

    if (proVariant) {
      this.variantByPlan.set(PlanTier.PRO, proVariant);
      this.planByVariant.set(proVariant, PlanTier.PRO);
    }
    if (premiumVariant) {
      this.variantByPlan.set(PlanTier.PREMIUM, premiumVariant);
      this.planByVariant.set(premiumVariant, PlanTier.PREMIUM);
    }

    if (!this.isConfigured) {
      this.logger.warn(
        'Lemon Squeezy is not configured — /billing/checkout and /billing/webhook will return 503. ' +
          'Set LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID and LEMON_SQUEEZY_WEBHOOK_SECRET to enable billing.',
      );
    }
  }

  /** Checkout needs the API key + store; the webhook needs the signing secret. */
  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.storeId && this.webhookSecret);
  }

  get isWebhookConfigured(): boolean {
    return Boolean(this.webhookSecret);
  }

  getVariantId(plan: PlanTier): string | undefined {
    return this.variantByPlan.get(plan);
  }

  /**
   * Resolves the tier a Lemon Squeezy variant grants. Returns undefined for an
   * unknown variant — the webhook treats that as "not ours" and refuses to guess,
   * because defaulting to a paid tier would let any product in the store grant
   * entitlements.
   */
  getPlanForVariant(variantId: string | number | null | undefined): PlanTier | undefined {
    if (variantId === null || variantId === undefined) {
      return undefined;
    }
    return this.planByVariant.get(String(variantId));
  }
}
