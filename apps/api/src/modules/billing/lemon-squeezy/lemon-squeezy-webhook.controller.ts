import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { LemonSqueezyService } from './lemon-squeezy.service';
import { LemonSqueezyWebhookService } from './lemon-squeezy-webhook.service';
import type { LemonSqueezyWebhookPayload } from './lemon-squeezy.types';

/**
 * Lemon Squeezy webhook receiver.
 *
 * `@Public()` because the caller is Lemon Squeezy, not a logged-in user — the
 * HMAC signature is the authentication, and it is verified before the payload is
 * touched. Verification uses `req.rawBody` (enabled via `rawBody: true` in
 * main.ts): re-serializing the parsed JSON would change byte order/escaping and
 * break the HMAC.
 *
 * `@SkipThrottle()` because the client is a payment provider replaying deliveries,
 * not a user: dropping a retry with a 429 could leave a paid subscription
 * unapplied. Abuse is bounded by the HMAC (an unsigned request is rejected before
 * any database work) and by the idempotency ledger.
 */
@ApiTags('billing')
@Controller('billing')
export class LemonSqueezyWebhookController {
  private readonly logger = new Logger(LemonSqueezyWebhookController.name);

  constructor(
    private readonly lemonSqueezy: LemonSqueezyService,
    private readonly webhooks: LemonSqueezyWebhookService,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') signature: string,
  ): Promise<{ received: true; outcome: string }> {
    const rawBody = req.rawBody;

    // Throws 401 on a bad/missing signature, 503 if no secret is configured.
    this.lemonSqueezy.verifySignature(rawBody, signature);

    let payload: LemonSqueezyWebhookPayload;
    try {
      payload = JSON.parse((rawBody as Buffer).toString('utf8')) as LemonSqueezyWebhookPayload;
    } catch {
      throw new BadRequestException('Webhook body is not valid JSON.');
    }

    const result = await this.webhooks.process(rawBody as Buffer, payload);

    // 200 for every recognized-but-unactionable outcome so Lemon Squeezy stops
    // retrying. `unknown_status` is the exception: process() does not record it,
    // and returning non-2xx asks for a redelivery once the mapping is fixed.
    if (result.outcome === 'unknown_status') {
      throw new BadRequestException(`Unhandled subscription status for ${result.eventName}.`);
    }

    return { received: true, outcome: result.outcome };
  }
}
