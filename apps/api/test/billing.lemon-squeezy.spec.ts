import { createHmac } from 'node:crypto';
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PlanTier, SubscriptionStatus } from '@ai-career/shared';
import type { ConfigService } from '@nestjs/config';
import { LemonSqueezyConfig } from '../src/modules/billing/lemon-squeezy/lemon-squeezy.config';
import { LemonSqueezyService } from '../src/modules/billing/lemon-squeezy/lemon-squeezy.service';
import { LemonSqueezyWebhookService } from '../src/modules/billing/lemon-squeezy/lemon-squeezy-webhook.service';
import { CreateCheckoutDto } from '../src/modules/billing/dto/create-checkout.dto';
import type { BillingService } from '../src/modules/billing/billing.service';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

const WEBHOOK_SECRET = 'whsec-test-secret';
const PRO_VARIANT = '111111';
const PREMIUM_VARIANT = '222222';

function configService(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    LEMON_SQUEEZY_API_KEY: 'ls-api-key',
    LEMON_SQUEEZY_STORE_ID: '42',
    LEMON_SQUEEZY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    LEMON_SQUEEZY_VARIANT_ID_PRO: PRO_VARIANT,
    LEMON_SQUEEZY_VARIANT_ID_PREMIUM: PREMIUM_VARIANT,
    WEB_URL: 'https://app.example.com',
    ...overrides,
  };
  return {
    get: <T>(key: string, fallback?: T) => (values[key] as unknown as T) ?? fallback,
  } as unknown as ConfigService;
}

function sign(body: string, secret = WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('hex');
}

function payload(overrides: {
  event?: string;
  variantId?: string | number;
  status?: string;
  cancelled?: boolean;
  userId?: string | null;
  email?: string;
  subscriptionId?: string;
  rendersAt?: string | null;
  endsAt?: string | null;
} = {}) {
  const {
    event = 'subscription_created',
    variantId = PRO_VARIANT,
    status = 'active',
    cancelled = false,
    userId = 'user-1',
    email = 'demo@aicareer.dev',
    subscriptionId = 'sub-9001',
    rendersAt = '2026-08-30T00:00:00.000Z',
    endsAt = null,
  } = overrides;

  return {
    meta: {
      event_name: event,
      ...(userId ? { custom_data: { user_id: userId, plan: PlanTier.PRO } } : {}),
    },
    data: {
      id: subscriptionId,
      type: 'subscriptions',
      attributes: {
        store_id: 42,
        customer_id: 7,
        variant_id: Number(variantId),
        user_email: email,
        status,
        cancelled,
        renews_at: rendersAt,
        ends_at: endsAt,
        trial_ends_at: null,
        created_at: '2026-07-30T00:00:00.000Z',
      },
    },
  };
}

interface Harness {
  service: LemonSqueezyWebhookService;
  prisma: {
    billingWebhookEvent: { findUnique: jest.Mock; create: jest.Mock };
    subscription: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  applyProviderSubscription: jest.Mock;
}

function createHarness(
  options: {
    alreadyProcessed?: boolean;
    userExists?: boolean;
    boundSubscriptionUserId?: string | null;
    userByEmail?: string | null;
    configOverrides?: Record<string, string>;
  } = {},
): Harness {
  const {
    alreadyProcessed = false,
    userExists = true,
    boundSubscriptionUserId = null,
    userByEmail = null,
    configOverrides = {},
  } = options;

  const prisma = {
    billingWebhookEvent: {
      findUnique: jest.fn(async () => (alreadyProcessed ? { id: 'ledger-1' } : null)),
      create: jest.fn(async () => ({ id: 'ledger-2' })),
    },
    subscription: {
      findFirst: jest.fn(async () =>
        boundSubscriptionUserId ? { userId: boundSubscriptionUserId } : null,
      ),
    },
    user: {
      findUnique: jest.fn(async (args: { where: { id?: string; email?: string } }) => {
        if (args.where.id) {
          return userExists ? { id: args.where.id } : null;
        }
        return userByEmail ? { id: userByEmail } : null;
      }),
    },
  };

  const applyProviderSubscription = jest.fn(async () => ({ id: 'sub-row' }));
  const billing = { applyProviderSubscription } as unknown as BillingService;
  const lsConfig = new LemonSqueezyConfig(configService(configOverrides));

  const service = new LemonSqueezyWebhookService(
    prisma as unknown as PrismaService,
    billing,
    lsConfig,
  );

  return { service, prisma, applyProviderSubscription };
}

async function process(harness: Harness, body: unknown) {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  return harness.service.process(raw, body as never);
}

describe('LemonSqueezyConfig', () => {
  it('maps configured variant ids in both directions', () => {
    const config = new LemonSqueezyConfig(configService());

    expect(config.isConfigured).toBe(true);
    expect(config.getVariantId(PlanTier.PRO)).toBe(PRO_VARIANT);
    // Lemon Squeezy sends variant_id as a number; the map is keyed by string.
    expect(config.getPlanForVariant(Number(PREMIUM_VARIANT))).toBe(PlanTier.PREMIUM);
  });

  it('refuses to guess a plan for an unknown or missing variant', () => {
    const config = new LemonSqueezyConfig(configService());

    expect(config.getPlanForVariant('999999')).toBeUndefined();
    expect(config.getPlanForVariant(null)).toBeUndefined();
    expect(config.getPlanForVariant(undefined)).toBeUndefined();
  });

  it('reports not-configured instead of throwing, so the API still boots', () => {
    const config = new LemonSqueezyConfig(
      configService({ LEMON_SQUEEZY_API_KEY: '', LEMON_SQUEEZY_WEBHOOK_SECRET: '' }),
    );

    expect(config.isConfigured).toBe(false);
    expect(config.isWebhookConfigured).toBe(false);
  });
});

describe('LemonSqueezyService.verifySignature', () => {
  const service = () => new LemonSqueezyService(new LemonSqueezyConfig(configService()), configService());

  it('accepts a signature computed over the exact raw bytes', () => {
    const body = JSON.stringify(payload());
    expect(() => service().verifySignature(Buffer.from(body, 'utf8'), sign(body))).not.toThrow();
  });

  it('rejects a signature made with the wrong secret', () => {
    const body = JSON.stringify(payload());
    expect(() =>
      service().verifySignature(Buffer.from(body, 'utf8'), sign(body, 'other-secret')),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a valid signature checked against re-serialized JSON', () => {
    // Byte-for-byte identical content, different key order: this is exactly what
    // happens if the parsed body is stringified again instead of using rawBody.
    const original = '{"a":1,"b":2}';
    const reserialized = '{"b":2,"a":1}';
    expect(() =>
      service().verifySignature(Buffer.from(reserialized, 'utf8'), sign(original)),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing or malformed signature header', () => {
    const raw = Buffer.from('{}', 'utf8');
    expect(() => service().verifySignature(raw, undefined)).toThrow(UnauthorizedException);
    expect(() => service().verifySignature(raw, '')).toThrow(UnauthorizedException);
    expect(() => service().verifySignature(raw, 'not-hex')).toThrow(UnauthorizedException);
  });

  it('refuses to verify without the raw body rather than falling back', () => {
    expect(() => service().verifySignature(undefined, sign('{}'))).toThrow(BadRequestException);
    expect(() => service().verifySignature(Buffer.alloc(0), sign('{}'))).toThrow(
      BadRequestException,
    );
  });

  it('answers 503 when no webhook secret is configured', () => {
    const unconfigured = new LemonSqueezyService(
      new LemonSqueezyConfig(configService({ LEMON_SQUEEZY_WEBHOOK_SECRET: '' })),
      configService({ LEMON_SQUEEZY_WEBHOOK_SECRET: '' }),
    );
    expect(() => unconfigured.verifySignature(Buffer.from('{}'), sign('{}'))).toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('LemonSqueezyWebhookService', () => {
  it('applies a new subscription and records it in the ledger', async () => {
    const harness = createHarness();

    const result = await process(harness, payload());

    expect(result.outcome).toBe('applied');
    expect(harness.applyProviderSubscription).toHaveBeenCalledTimes(1);
    expect(harness.applyProviderSubscription.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      plan: PlanTier.PRO,
      status: SubscriptionStatus.ACTIVE,
      provider: 'lemonsqueezy',
      externalSubscriptionId: 'sub-9001',
      cancelAtPeriodEnd: false,
    });
    expect(harness.prisma.billingWebhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: a replayed delivery does not re-apply the subscription', async () => {
    const harness = createHarness({ alreadyProcessed: true });

    const result = await process(harness, payload());

    expect(result.outcome).toBe('duplicate');
    expect(harness.applyProviderSubscription).not.toHaveBeenCalled();
    expect(harness.prisma.billingWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('derives the idempotency key from the raw bytes, so a real update is not swallowed', async () => {
    const harness = createHarness();

    await process(harness, payload());
    await process(harness, payload({ event: 'subscription_updated', status: 'past_due' }));

    const keys = harness.prisma.billingWebhookEvent.findUnique.mock.calls.map(
      (call) => (call[0] as { where: { provider_eventId: { eventId: string } } }).where
        .provider_eventId.eventId,
    );
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it('grants nothing for a variant that is not mapped to a plan', async () => {
    const harness = createHarness();

    const result = await process(harness, payload({ variantId: 987654 }));

    expect(result.outcome).toBe('unknown_variant');
    expect(harness.applyProviderSubscription).not.toHaveBeenCalled();
    // Recorded so the delivery is not retried forever for a foreign product.
    expect(harness.prisma.billingWebhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it('leaves the plan untouched and stays retryable on an unrecognized status', async () => {
    const harness = createHarness();

    const result = await process(harness, payload({ status: 'quantum_superposition' }));

    expect(result.outcome).toBe('unknown_status');
    expect(harness.applyProviderSubscription).not.toHaveBeenCalled();
    // Deliberately NOT recorded: a redelivery after a mapping fix must be allowed.
    expect(harness.prisma.billingWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('keeps a cancelled subscription active until ends_at', async () => {
    const harness = createHarness();

    const result = await process(
      harness,
      payload({
        event: 'subscription_cancelled',
        status: 'cancelled',
        cancelled: true,
        endsAt: '2026-09-15T00:00:00.000Z',
        rendersAt: '2026-08-30T00:00:00.000Z',
      }),
    );

    expect(result.outcome).toBe('applied');
    const applied = harness.applyProviderSubscription.mock.calls[0][0];
    expect(applied.status).toBe(SubscriptionStatus.ACTIVE);
    expect(applied.cancelAtPeriodEnd).toBe(true);
    // ends_at wins over renews_at once cancelled: the paid period is not revoked.
    expect((applied.currentPeriodEnd as Date).toISOString()).toBe('2026-09-15T00:00:00.000Z');
  });

  it('revokes access when a subscription expires', async () => {
    const harness = createHarness();

    const result = await process(
      harness,
      payload({ event: 'subscription_expired', status: 'expired' }),
    );

    expect(result.outcome).toBe('applied');
    expect(harness.applyProviderSubscription.mock.calls[0][0].status).toBe(
      SubscriptionStatus.EXPIRED,
    );
  });

  it('falls back to the bound subscription id when custom_data is absent', async () => {
    const harness = createHarness({ boundSubscriptionUserId: 'user-42' });

    const result = await process(harness, payload({ userId: null }));

    expect(result.outcome).toBe('applied');
    expect(harness.applyProviderSubscription.mock.calls[0][0].userId).toBe('user-42');
  });

  it('falls back to the billing email as a last resort', async () => {
    const harness = createHarness({ userByEmail: 'user-77' });

    const result = await process(harness, payload({ userId: null }));

    expect(result.outcome).toBe('applied');
    expect(harness.applyProviderSubscription.mock.calls[0][0].userId).toBe('user-77');
  });

  it('ignores a custom_data user id that does not exist instead of trusting it', async () => {
    const harness = createHarness({ userExists: false });

    const result = await process(harness, payload({ userId: 'ghost-user' }));

    expect(result.outcome).toBe('unattributed');
    expect(harness.applyProviderSubscription).not.toHaveBeenCalled();
  });

  it('acknowledges events it does not handle without touching the plan', async () => {
    const harness = createHarness();

    const result = await process(harness, payload({ event: 'order_created' }));

    expect(result.outcome).toBe('ignored_event');
    expect(harness.applyProviderSubscription).not.toHaveBeenCalled();
  });
});

describe('BillingModule wiring', () => {
  /**
   * Guards the failure mode that a compile-time check cannot see: the Lemon Squeezy
   * providers being absent from BillingModule while BillingController injects them.
   * That combination type-checks perfectly and only fails when Nest builds the
   * container at boot.
   */
  it('resolves the checkout controller and the webhook receiver', async () => {
    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: ConfigServiceToken, useValue: configService() },
      ],
      exports: [PrismaService, ConfigServiceToken],
    })
    class TestInfraModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, BillingModule],
    }).compile();

    expect(moduleRef.get(BillingController)).toBeDefined();
    expect(moduleRef.get(LemonSqueezyWebhookController)).toBeDefined();
    expect(moduleRef.get(BillingService)).toBeDefined();
    await moduleRef.close();
  });
});

describe('CreateCheckoutDto', () => {  const validate = (input: Record<string, unknown>) =>
    validateSync(plainToInstance(CreateCheckoutDto, input)).flatMap((error) =>
      Object.keys(error.constraints ?? {}).map(() => error.property),
    );

  it('accepts the purchasable tiers', () => {
    expect(validate({ plan: PlanTier.PRO })).toEqual([]);
    expect(validate({ plan: PlanTier.PREMIUM })).toEqual([]);
  });

  it('rejects FREE and unknown tiers', () => {
    expect(validate({ plan: PlanTier.FREE })).toContain('plan');
    expect(validate({ plan: 'ENTERPRISE' })).toContain('plan');
    expect(validate({})).toContain('plan');
  });

  it('accepts a relative redirect path', () => {
    expect(validate({ plan: PlanTier.PRO, redirectPath: '/dashboard' })).toEqual([]);
    expect(validate({ plan: PlanTier.PRO, redirectPath: '/dashboard?checkout=success' })).toEqual(
      [],
    );
  });

  it('rejects redirect targets that would leave the site', () => {
    // Protocol-relative: navigates to https://evil.com despite the leading slash.
    expect(validate({ plan: PlanTier.PRO, redirectPath: '//evil.com' })).toContain('redirectPath');
    expect(validate({ plan: PlanTier.PRO, redirectPath: 'https://evil.com' })).toContain(
      'redirectPath',
    );
    expect(validate({ plan: PlanTier.PRO, redirectPath: 'dashboard' })).toContain('redirectPath');
  });
});
