import { PlanFeature, PlanTier, SubscriptionStatus } from '../enums';

/**
 * Plan limits/entitlements. Intentionally provider-agnostic — Phase 2 ships the
 * architecture only; a payment provider (Stripe) plugs in at the Subscription level
 * without touching entitlement checks.
 */
export interface PlanLimits {
  maxSavedJobs: number | null;
  maxJobAlerts: number | null;
  maxApplications: number | null;
  /** Hours a freshly ingested job stays exclusive to early-access plans. */
  earlyAccessHours: number;
  /** Total resumes a user may have stored at once. */
  maxResumes: number | null;
  /** AI ATS checks (resume-vs-job) allowed per calendar month. */
  maxAtsChecksPerMonth: number | null;
  features: PlanFeature[];
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  description: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  highlights: string[];
  limits: PlanLimits;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Runtime view of what a user may do — returned by GET /billing/entitlements. */
export interface Entitlements {
  plan: PlanTier;
  status: SubscriptionStatus;
  limits: PlanLimits;
  usage: {
    savedJobs: number;
    jobAlerts: number;
    applications: number;
    resumes: number;
    /** ATS checks used so far in the current calendar month. */
    atsChecksThisMonth: number;
  };
}


/** Body of POST /billing/checkout. The user is taken from the JWT, never the body. */
export interface CreateCheckoutRequest {
  plan: PlanTier;
  /** Optional path on the web app to return to after payment (e.g. `/dashboard`). */
  redirectPath?: string;
}

/** Response of POST /billing/checkout — the hosted Lemon Squeezy checkout URL. */
export interface CheckoutSession {
  url: string;
  plan: PlanTier;
}
