/**
 * Shared constants — cookie names, route paths, validation limits, plan catalog.
 * Keeping these centralized avoids magic-string drift between API and Web.
 */
import { AiProvider, PlanFeature, PlanTier } from './enums';
import type { PlanDefinition, PlanLimits } from './types/billing';
import type {
  AiModelOption,
  EvaluationCriterionDefinition,
  EvaluationCriterionKey,
} from './types/evaluation';

export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 30;

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const API_ROUTES = {
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    VERIFY_EMAIL: '/auth/verify-email',
    RESEND_VERIFICATION: '/auth/resend-verification',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  USERS: {
    PROFILE: '/users/me/profile',
  },
  JOBS: {
    LIST: '/jobs',
    FACETS: '/jobs/facets',
    DETAIL: (idOrSlug: string) => `/jobs/${idOrSlug}`,
    SIMILAR: (id: string) => `/jobs/${id}/similar`,
  },
  COMPANIES: {
    LIST: '/companies',
    DETAIL: (idOrSlug: string) => `/companies/${idOrSlug}`,
    JOBS: (idOrSlug: string) => `/companies/${idOrSlug}/jobs`,
  },
  SAVED_JOBS: {
    LIST: '/saved-jobs',
    CREATE: '/saved-jobs',
    DETAIL: (jobId: string) => `/saved-jobs/${jobId}`,
  },
  JOB_ALERTS: {
    LIST: '/job-alerts',
    CREATE: '/job-alerts',
    DETAIL: (id: string) => `/job-alerts/${id}`,
    PREVIEW: (id: string) => `/job-alerts/${id}/preview`,
  },
  APPLICATIONS: {
    LIST: '/applications',
    BOARD: '/applications/board',
    STATS: '/applications/stats',
    CREATE: '/applications',
    DETAIL: (id: string) => `/applications/${id}`,
    STATUS: (id: string) => `/applications/${id}/status`,
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    READ: (id: string) => `/notifications/${id}/read`,
    READ_ALL: '/notifications/read-all',
  },
  BILLING: {
    PLANS: '/billing/plans',
    SUBSCRIPTION: '/billing/subscription',
    ENTITLEMENTS: '/billing/entitlements',
    /** POST — creates a Lemon Squeezy checkout for the authenticated caller. */
    CHECKOUT: '/billing/checkout',
  },
  EVALUATIONS: {
    LIST: '/evaluations',
    SUMMARY: '/evaluations/summary',
    MODELS: '/evaluations/models',
    GRADES: '/evaluations/grades',
    /** POST evaluates (BYOK headers), GET reads, DELETE discards. */
    FOR_JOB: (jobId: string) => `/evaluations/jobs/${jobId}`,
  },
  RESUMES: {
    LIST: '/resumes',
    UPLOAD: '/resumes/upload',
    ATS_SCORE: '/resumes/ats-score',
    DETAIL: (id: string) => `/resumes/${id}`,
    FILE: (id: string) => `/resumes/${id}/file`,
    ATS_SCORE_FOR_JOB: (resumeId: string, jobId: string) =>
      `/resumes/${resumeId}/ats-score/${jobId}`,
  },
  ANALYTICS: {
    ME: '/analytics/me',
    OVERVIEW: '/analytics/overview',
    DAILY: '/analytics/daily',
  },
  ADMIN: {
    USERS: '/admin/users',
    USER_ROLE: (id: string) => `/admin/users/${id}/role`,
    USER_PLAN: (id: string) => `/admin/users/${id}/plan`,
    JOBS: '/admin/jobs',
    JOB_DETAIL: (id: string) => `/admin/jobs/${id}`,
    COMPANIES: '/admin/companies',
    SOURCES: '/admin/scraper/sources',
    SOURCE_DETAIL: (id: string) => `/admin/scraper/sources/${id}`,
    SOURCE_TRIGGER: (id: string) => `/admin/scraper/sources/${id}/trigger`,
    SCRAPER_STATUS: '/admin/scraper/status',
    SCRAPER_RUNS: '/admin/scraper/runs',
    SCRAPER_FAILURES: '/admin/scraper/runs/failed',
    SCRAPER_RETRY: (runId: string) => `/admin/scraper/runs/${runId}/retry`,
    LOGS: '/admin/logs',
    QUEUES: '/admin/queues',
  },
} as const;

/** BullMQ queue names — shared so producers/consumers cannot drift. */
export const QUEUE_NAMES = {
  SCRAPER: 'scraper',
  NOTIFICATIONS: 'notifications',
  MAINTENANCE: 'maintenance',
} as const;

export const JOB_NAMES = {
  SCRAPE_SOURCE: 'scrape-source',
  SCHEDULE_ALL_SOURCES: 'schedule-all-sources',
  MATCH_NEW_JOBS: 'match-new-jobs',
  SEND_ALERT_DIGEST: 'send-alert-digest',
  SEND_NOTIFICATION: 'send-notification',
  APPLICATION_REMINDERS: 'application-reminders',
  EXPIRE_STALE_JOBS: 'expire-stale-jobs',
  COMPUTE_DAILY_STATS: 'compute-daily-stats',
  PRUNE_LOGS: 'prune-logs',
} as const;

const FREE_LIMITS: PlanLimits = {
  maxSavedJobs: 25,
  maxJobAlerts: 1,
  maxApplications: 50,
  earlyAccessHours: 0,
  maxResumes: 1,
  maxAtsChecksPerMonth: 3,
  features: [],
};

const PRO_LIMITS: PlanLimits = {
  maxSavedJobs: 250,
  maxJobAlerts: 10,
  maxApplications: null,
  earlyAccessHours: 6,
  maxResumes: 5,
  maxAtsChecksPerMonth: null,
  features: [
    PlanFeature.ADVANCED_FILTERS,
    PlanFeature.APPLICATION_ANALYTICS,
    PlanFeature.EARLY_JOB_ACCESS,
  ],
};

const PREMIUM_LIMITS: PlanLimits = {
  maxSavedJobs: null,
  maxJobAlerts: null,
  maxApplications: null,
  earlyAccessHours: 12,
  maxResumes: null,
  maxAtsChecksPerMonth: null,
  features: [
    PlanFeature.ADVANCED_FILTERS,
    PlanFeature.APPLICATION_ANALYTICS,
    PlanFeature.EARLY_JOB_ACCESS,
    PlanFeature.COMPANY_INSIGHTS,
    PlanFeature.INSTANT_ALERTS,
  ],
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  [PlanTier.FREE]: FREE_LIMITS,
  [PlanTier.PRO]: PRO_LIMITS,
  [PlanTier.PREMIUM]: PREMIUM_LIMITS,
};

/**
 * Window (in hours) during which brand-new jobs are exclusive to plans holding
 * EARLY_JOB_ACCESS. Free users see them once the window elapses.
 */
export const EARLY_ACCESS_WINDOW_HOURS = 12;

export const PLAN_CATALOG: PlanDefinition[] = [
  {
    tier: PlanTier.FREE,
    name: 'Free',
    description: 'Explore the job feed and track a handful of applications.',
    monthlyPriceUsd: 0,
    yearlyPriceUsd: 0,
    highlights: ['Job search & basic filters', '25 saved jobs', '1 daily job alert'],
    limits: FREE_LIMITS,
  },
  {
    tier: PlanTier.PRO,
    name: 'Pro',
    description: 'Serious job seekers who want an edge on timing and filtering.',
    monthlyPriceUsd: 15,
    yearlyPriceUsd: 150,
    highlights: [
      'Advanced filters (salary, skills, visa)',
      '6-hour early job access',
      'Application analytics',
      '10 job alerts',
    ],
    limits: PRO_LIMITS,
  },
  {
    tier: PlanTier.PREMIUM,
    name: 'Premium',
    description: 'Everything unlimited, plus company intelligence and instant alerts.',
    monthlyPriceUsd: 29,
    yearlyPriceUsd: 290,
    highlights: [
      'Unlimited saved jobs & alerts',
      '12-hour early job access',
      'Company insights & hiring velocity',
      'Instant alert notifications',
    ],
    limits: PREMIUM_LIMITS,
  },
];

export function getPlanLimits(plan: PlanTier): PlanLimits {
  return PLAN_LIMITS[plan] ?? FREE_LIMITS;
}

/**
 * Tiers that can actually be bought. FREE is the implicit default assigned on
 * signup, so a checkout request for it is a client bug rather than a purchase —
 * the checkout DTO rejects anything outside this list.
 */
export const PURCHASABLE_PLAN_TIERS: readonly PlanTier[] = [PlanTier.PRO, PlanTier.PREMIUM];

export function planHasFeature(plan: PlanTier, feature: PlanFeature): boolean {
  return getPlanLimits(plan).features.includes(feature);
}


// ---------------------------------------------------------------------------
// AI job evaluation (BYOK)
// ---------------------------------------------------------------------------

/**
 * The A-F rubric. Weights are the contract between the prompt, the parser and the
 * dashboard: the model scores each dimension 1.0-5.0 and the server computes the
 * overall score as the weighted mean, so a model cannot invent an overall score
 * that its own breakdown does not support.
 *
 * Weights sum to 1 — see {@link EVALUATION_WEIGHT_TOTAL}, asserted in tests.
 */
export const EVALUATION_CRITERIA: readonly EvaluationCriterionDefinition[] = [
  {
    key: 'skillsMatch',
    label: 'Skills match',
    weight: 0.3,
    description:
      'Overlap between the skills the listing requires and the skills the candidate has. Weight missing must-haves more heavily than missing nice-to-haves.',
  },
  {
    key: 'experienceMatch',
    label: 'Experience & seniority',
    weight: 0.2,
    description:
      'Fit between the required seniority/years of experience and the candidate. Both under-qualified and heavily over-qualified are poor fits.',
  },
  {
    key: 'compensation',
    label: 'Compensation',
    weight: 0.15,
    description:
      'How the stated salary compares with the candidate expectation. Score 3.0 when the listing discloses no compensation — absence of data is not a negative signal.',
  },
  {
    key: 'locationFit',
    label: 'Location & work model',
    weight: 0.1,
    description:
      'Whether the location, remote/hybrid/onsite model and any visa requirement work for the candidate preferences.',
  },
  {
    key: 'roleClarity',
    label: 'Role clarity',
    weight: 0.15,
    description:
      'Quality of the posting itself: clear responsibilities, concrete requirements, no vague or contradictory content.',
  },
  {
    key: 'growthPotential',
    label: 'Growth potential',
    weight: 0.1,
    description:
      'Career upside: scope, technologies, seniority trajectory and company signals visible in the posting.',
  },
] as const;

export const EVALUATION_CRITERION_KEYS = EVALUATION_CRITERIA.map(
  (criterion) => criterion.key,
) as EvaluationCriterionKey[];

export const EVALUATION_WEIGHT_TOTAL = EVALUATION_CRITERIA.reduce(
  (total, criterion) => total + criterion.weight,
  0,
);

export function getEvaluationCriterion(
  key: EvaluationCriterionKey,
): EvaluationCriterionDefinition | undefined {
  return EVALUATION_CRITERIA.find((criterion) => criterion.key === key);
}

/**
 * BYOK transport. Credentials travel in headers rather than the JSON body so they
 * never end up in validation error echoes, request-body logs or Swagger examples.
 */
export const AI_HEADERS = {
  PROVIDER: 'x-ai-provider',
  API_KEY: 'x-ai-api-key',
  MODEL: 'x-ai-model',
} as const;

/** Default model per vendor, used when the client sends no `x-ai-model`. */
export const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  [AiProvider.ANTHROPIC]: 'claude-sonnet-4-20250514',
  [AiProvider.OPENAI]: 'gpt-4o-mini',
};

/** Catalog offered in the API-key modal. Users may also type any model id. */
export const AI_MODEL_OPTIONS: readonly AiModelOption[] = [
  {
    provider: AiProvider.ANTHROPIC,
    model: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    hint: 'Balanced quality and cost',
  },
  {
    provider: AiProvider.ANTHROPIC,
    model: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    hint: 'Cheapest, fastest',
  },
  {
    provider: AiProvider.ANTHROPIC,
    model: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    hint: 'Most capable, most expensive',
  },
  {
    provider: AiProvider.OPENAI,
    model: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    hint: 'Cheapest, fastest',
  },
  { provider: AiProvider.OPENAI, model: 'gpt-4o', label: 'GPT-4o', hint: 'Balanced' },
  {
    provider: AiProvider.OPENAI,
    model: 'gpt-4.1',
    label: 'GPT-4.1',
    hint: 'Most capable, most expensive',
  },
] as const;

export function getModelOptions(provider: AiProvider): AiModelOption[] {
  return AI_MODEL_OPTIONS.filter((option) => option.provider === provider);
}

/** Human label for each vendor, shown in the modal and on evaluation cards. */
export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  [AiProvider.ANTHROPIC]: 'Anthropic (Claude)',
  [AiProvider.OPENAI]: 'OpenAI',
};

/** Where users create the key — linked from the modal so the flow is self-serve. */
export const AI_PROVIDER_KEY_URLS: Record<AiProvider, string> = {
  [AiProvider.ANTHROPIC]: 'https://console.anthropic.com/settings/keys',
  [AiProvider.OPENAI]: 'https://platform.openai.com/api-keys',
};

/**
 * Cheap client-side shape check so an obviously wrong paste (e.g. an OpenAI key
 * selected as Anthropic) is caught before spending a request. Deliberately loose:
 * vendors change prefixes, so this warns rather than blocks server-side.
 */
export const AI_KEY_PREFIXES: Record<AiProvider, string> = {
  [AiProvider.ANTHROPIC]: 'sk-ant-',
  [AiProvider.OPENAI]: 'sk-',
};
