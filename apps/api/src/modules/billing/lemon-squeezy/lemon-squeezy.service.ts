import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCheckout, lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js';
import { PlanTier } from '@ai-career/shared';
import { LemonSqueezyConfig } from './lemon-squeezy.config';

/**
 * Thin wrapper over the Lemon Squeezy SDK plus webhook signature verification.
 *
 * Kept separate from BillingService so entitlement resolution stays free of
 * vendor concerns: BillingService owns "what may this user do", this class owns
 * "what did the payment provider say".
 */
@Injectable()
export class LemonSqueezyService {
  private readonly logger = new Logger(LemonSqueezyService.name);
  private isSdkReady = false;

  constructor(
    private readonly lsConfig: LemonSqueezyConfig,
    private readonly config: ConfigService,
  ) {}

  /**
   * Configures the SDK singleton lazily. Done on first use rather than in the
   * constructor so an unconfigured deployment does not register a bogus key.
   */
  private ensureSdk(): void {
    if (this.isSdkReady) {
      return;
    }
    if (!this.lsConfig.isConfigured) {
      throw new ServiceUnavailableException({
        message: 'Billing is not configured on this server.',
        error: 'BILLING_NOT_CONFIGURED',
      });
    }
    lemonSqueezySetup({
      apiKey: this.lsConfig.apiKey,
      onError: (error) => this.logger.error(`Lemon Squeezy API error: ${error.message}`),
    });
    this.isSdkReady = true;
  }

  /**
   * Creates a hosted checkout for `plan` and returns its URL.
   *
   * `userId` comes from the JWT at the controller boundary — never from the
   * request body — and is echoed back to us in `meta.custom_data.user_id` by the
   * webhook, which is how a payment is attributed to an account. Trusting a
   * client-supplied id here would let any caller purchase a plan onto (or, worse,
   * bind their own subscription to) someone else's account.
   */
  async createCheckoutUrl(params: {
    userId: string;
    email: string;
    name?: string;
    plan: PlanTier;
    redirectPath?: string;
  }): Promise<string> {
    this.ensureSdk();

    const variantId = this.lsConfig.getVariantId(params.plan);
    if (!variantId) {
      throw new ServiceUnavailableException({
        message: `No Lemon Squeezy variant is configured for the ${params.plan} plan.`,
        error: 'BILLING_VARIANT_NOT_CONFIGURED',
        plan: params.plan,
      });
    }

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000').replace(/\/$/, '');
    const redirectUrl = `${webUrl}${this.normalizeRedirectPath(params.redirectPath)}`;

    const { data, error } = await createCheckout(this.lsConfig.storeId, variantId, {
      checkoutData: {
        email: params.email,
        name: params.name,
        // Echoed back in the webhook as meta.custom_data — the attribution seam.
        custom: { user_id: params.userId, plan: params.plan },
      },
      productOptions: {
        redirectUrl,
        enabledVariants: [Number(variantId)],
      },
      checkoutOptions: {
        embed: false,
      },
    });

    if (error) {
      this.logger.error(`Failed to create checkout for user ${params.userId}: ${error.message}`);
      throw new ServiceUnavailableException({
        message: 'Could not start checkout. Please try again.',
        error: 'BILLING_CHECKOUT_FAILED',
      });
    }

    const url = data?.data?.attributes?.url;
    if (!url) {
      throw new ServiceUnavailableException({
        message: 'Checkout provider did not return a URL.',
        error: 'BILLING_CHECKOUT_FAILED',
      });
    }
    return url;
  }

  /**
   * Only same-origin relative paths are allowed. An attacker-supplied absolute
   * URL here would turn the post-payment redirect into an open redirect on our
   * own domain, which is a convincing phishing primitive.
   */
  private normalizeRedirectPath(path?: string): string {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
      return '/dashboard';
    }
    return path;
  }

  /**
   * Verifies the `X-Signature` header against the RAW request body.
   *
   * Must be the exact bytes Lemon Squeezy signed: re-serializing the parsed JSON
   * (JSON.stringify(req.body)) can reorder keys or change escaping and will fail
   * verification, which is why main.ts enables `rawBody`.
   */
  verifySignature(rawBody: Buffer | undefined, signatureHeader: unknown): void {
    if (!this.lsConfig.isWebhookConfigured) {
      throw new ServiceUnavailableException({
        message: 'Billing webhook is not configured on this server.',
        error: 'BILLING_NOT_CONFIGURED',
      });
    }
    if (!rawBody?.length) {
      // Signature cannot be checked without the original bytes; refuse rather
      // than fall back to the parsed body.
      throw new BadRequestException('Missing raw request body for signature verification.');
    }

    const signature = typeof signatureHeader === 'string' ? signatureHeader.trim() : '';
    if (!signature) {
      throw new UnauthorizedException('Missing X-Signature header.');
    }

    const expected = createHmac('sha256', this.lsConfig.webhookSecret).update(rawBody).digest();

    let received: Buffer;
    try {
      received = Buffer.from(signature, 'hex');
    } catch {
      throw new UnauthorizedException('Malformed webhook signature.');
    }

    // timingSafeEqual throws on length mismatch, so compare lengths first —
    // and never short-circuit on content, to keep the comparison constant-time.
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      this.logger.warn('Rejected billing webhook with an invalid signature.');
      throw new UnauthorizedException('Invalid webhook signature.');
    }
  }
}
