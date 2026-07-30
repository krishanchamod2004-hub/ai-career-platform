import { SetMetadata } from '@nestjs/common';
import { PlanFeature } from '@ai-career/shared';

export const REQUIRED_FEATURE_KEY = 'requiredFeature';

/**
 * Gates a route behind a plan feature.
 * Usage: `@RequireFeature(PlanFeature.APPLICATION_ANALYTICS)` — enforced by PlanFeatureGuard.
 */
export const RequireFeature = (feature: PlanFeature) =>
  SetMetadata(REQUIRED_FEATURE_KEY, feature);
