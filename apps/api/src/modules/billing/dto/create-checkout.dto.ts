import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanTier, PURCHASABLE_PLAN_TIERS } from '@ai-career/shared';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Body of POST /billing/checkout.
 *
 * Deliberately has NO `userId`: the account being upgraded is taken from the JWT
 * in the controller. Accepting it from the client would let any caller start a
 * checkout that binds a subscription to someone else's account.
 */
export class CreateCheckoutDto {
  @ApiProperty({
    enum: PURCHASABLE_PLAN_TIERS as PlanTier[],
    description: 'Paid tier to purchase. FREE is not purchasable.',
  })
  @IsIn(PURCHASABLE_PLAN_TIERS as PlanTier[], {
    message: `plan must be one of: ${PURCHASABLE_PLAN_TIERS.join(', ')}`,
  })
  plan!: PlanTier;

  @ApiPropertyOptional({
    description:
      'Relative path on the web app to return to after payment. Absolute URLs are rejected to avoid an open redirect.',
    example: '/dashboard',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  // Single leading slash only — `//evil.com` is protocol-relative and would
  // navigate off-site, so it must not match.
  @Matches(/^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/, {
    message: 'redirectPath must be a relative path starting with a single "/"',
  })
  redirectPath?: string;
}
