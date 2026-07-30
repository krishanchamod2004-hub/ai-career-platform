import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanFeature, UserRole } from '@ai-career/shared';
import { BillingService } from '../../modules/billing/billing.service';
import { REQUIRED_FEATURE_KEY } from '../decorators/require-feature.decorator';
import type { AuthenticatedUser } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Enforces @RequireFeature(...) metadata against the caller's effective plan.
 * Admins bypass plan gating so support/debugging never needs a paid seat.
 */
@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeature | undefined>(
      REQUIRED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!feature) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    await this.billingService.assertFeature(user.id, feature);
    return true;
  }
}
