import { Global, Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { LemonSqueezyConfig } from './lemon-squeezy/lemon-squeezy.config';
import { LemonSqueezyService } from './lemon-squeezy/lemon-squeezy.service';
import { LemonSqueezyWebhookController } from './lemon-squeezy/lemon-squeezy-webhook.controller';
import { LemonSqueezyWebhookService } from './lemon-squeezy/lemon-squeezy-webhook.service';

/**
 * Global because entitlement checks are needed by feature modules and by the
 * global PlanFeatureGuard — importing it everywhere would be noise.
 *
 * The Lemon Squeezy providers are registered here but intentionally NOT exported:
 * the rest of the app talks to `BillingService`, so no feature module can grow a
 * dependency on the payment vendor. Only `BillingService` is exported.
 */
@Global()
@Module({
  controllers: [BillingController, LemonSqueezyWebhookController],
  providers: [
    BillingService,
    LemonSqueezyConfig,
    LemonSqueezyService,
    LemonSqueezyWebhookService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
