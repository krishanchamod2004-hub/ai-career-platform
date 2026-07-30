import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CheckoutSession } from '@ai-career/shared';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { LemonSqueezyService } from './lemon-squeezy/lemon-squeezy.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly lemonSqueezy: LemonSqueezyService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List available plans and their limits (pricing page)' })
  getPlans() {
    return this.billingService.getPlanCatalog();
  }

  @ApiBearerAuth()
  @Get('subscription')
  @ApiOperation({ summary: "Get the current user's subscription record" })
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getOrCreateSubscription(user.id);
  }

  @ApiBearerAuth()
  @Get('entitlements')
  @ApiOperation({ summary: 'Resolved plan limits, features, and current usage' })
  getEntitlements(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getEntitlements(user.id);
  }

  /**
   * The upgraded account is `user.id` from the verified JWT — the DTO has no
   * `userId` field at all, so there is no client-controlled path to charging or
   * upgrading a different account.
   */
  @ApiBearerAuth()
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Lemon Squeezy checkout for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Hosted checkout URL to redirect the browser to.' })
  @ApiResponse({ status: 503, description: 'Billing is not configured on this server.' })
  async createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
  ): Promise<CheckoutSession> {
    const url = await this.lemonSqueezy.createCheckoutUrl({
      userId: user.id,
      email: user.email,
      plan: dto.plan,
      redirectPath: dto.redirectPath,
    });
    return { url, plan: dto.plan };
  }
}
