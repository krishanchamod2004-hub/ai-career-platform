/**
 * Shared enums used across the platform (API, Web, Mobile).
 * Keep these in sync with the Prisma schema enums in apps/api/prisma/schema.prisma.
 */

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
}

export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  FREELANCE = 'FREELANCE',
}

export enum WorkLocationType {
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
  ONSITE = 'ONSITE',
}

/** Normalized seniority buckets — parsed from free-text job titles/descriptions. */
export enum ExperienceLevel {
  INTERNSHIP = 'INTERNSHIP',
  ENTRY = 'ENTRY',
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  PRINCIPAL = 'PRINCIPAL',
  EXECUTIVE = 'EXECUTIVE',
}

export enum SalaryPeriod {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum JobStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  FILLED = 'FILLED',
  ARCHIVED = 'ARCHIVED',
}

/** Which integration an ingested job came from. */
export enum JobSourceType {
  GREENHOUSE = 'GREENHOUSE',
  LEVER = 'LEVER',
  REMOTEOK = 'REMOTEOK',
  MANUAL = 'MANUAL',
  /** Aggregated boards fetched via the JobSpy sidecar (services/jobspy). */
  LINKEDIN = 'LINKEDIN',
  INDEED = 'INDEED',
  GLASSDOOR = 'GLASSDOOR',
  ZIPRECRUITER = 'ZIPRECRUITER',
}

/** Source types served by the JobSpy sidecar rather than a first-party ATS API. */
export const JOBSPY_SOURCE_TYPES = [
  JobSourceType.LINKEDIN,
  JobSourceType.INDEED,
  JobSourceType.GLASSDOOR,
  JobSourceType.ZIPRECRUITER,
] as const;

/** `site_name` value JobSpy expects for each source type. */
export const JOBSPY_SITE_BY_SOURCE_TYPE: Record<
  (typeof JOBSPY_SOURCE_TYPES)[number],
  string
> = {
  [JobSourceType.LINKEDIN]: 'linkedin',
  [JobSourceType.INDEED]: 'indeed',
  [JobSourceType.GLASSDOOR]: 'glassdoor',
  [JobSourceType.ZIPRECRUITER]: 'zip_recruiter',
};

/** Reverse of {@link JOBSPY_SITE_BY_SOURCE_TYPE}, for attributing scraped rows. */
export const SOURCE_TYPE_BY_JOBSPY_SITE: Record<string, JobSourceType> = {
  linkedin: JobSourceType.LINKEDIN,
  indeed: JobSourceType.INDEED,
  glassdoor: JobSourceType.GLASSDOOR,
  zip_recruiter: JobSourceType.ZIPRECRUITER,
};

export function isJobSpySourceType(type: JobSourceType | string): boolean {
  return (JOBSPY_SOURCE_TYPES as readonly string[]).includes(type as string);
}

export enum ScraperRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export enum ScraperTrigger {
  CRON = 'CRON',
  MANUAL = 'MANUAL',
  BACKFILL = 'BACKFILL',
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/** Application pipeline stages surfaced on the tracker board. */
export enum ApplicationStatus {
  SAVED = 'SAVED',
  APPLIED = 'APPLIED',
  INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER',
  REJECTED = 'REJECTED',
}

export enum AlertFrequency {
  INSTANT = 'INSTANT',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

export enum NotificationType {
  NEW_MATCHING_JOBS = 'NEW_MATCHING_JOBS',
  JOB_ALERT_DIGEST = 'JOB_ALERT_DIGEST',
  APPLICATION_REMINDER = 'APPLICATION_REMINDER',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

/** Subscription tiers. Billing provider integration is deliberately deferred. */
export enum PlanTier {
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
}

/**
 * Letter grade for an AI job evaluation. Five buckets so the 1.0-5.0 score maps
 * cleanly; there is deliberately no E, matching the conventional A-F scale.
 */
export enum EvaluationGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F',
}

/** LLM vendor that produced an evaluation. */
export enum AiProvider {
  ANTHROPIC = 'ANTHROPIC',
  OPENAI = 'OPENAI',
}

/** Inclusive lower bound of each grade on the 1.0-5.0 scale. */
export const EVALUATION_GRADE_THRESHOLDS: ReadonlyArray<{
  grade: EvaluationGrade;
  min: number;
}> = [
  { grade: EvaluationGrade.A, min: 4.5 },
  { grade: EvaluationGrade.B, min: 3.5 },
  { grade: EvaluationGrade.C, min: 2.5 },
  { grade: EvaluationGrade.D, min: 1.5 },
  { grade: EvaluationGrade.F, min: 0 },
];

export const EVALUATION_SCORE_MIN = 1;
export const EVALUATION_SCORE_MAX = 5;

/**
 * Single source of truth for score -> letter, so the API, the worker and the
 * dashboard can never disagree about what a 4.4 is.
 */
export function scoreToGrade(score: number): EvaluationGrade {
  const clamped = Math.min(
    EVALUATION_SCORE_MAX,
    Math.max(EVALUATION_SCORE_MIN, Number.isFinite(score) ? score : EVALUATION_SCORE_MIN),
  );
  // Round to one decimal first: an LLM returning 4.4999 should not become an A.
  const rounded = Math.round(clamped * 10) / 10;
  return (
    EVALUATION_GRADE_THRESHOLDS.find((entry) => rounded >= entry.min)?.grade ??
    EvaluationGrade.F
  );
}

/** Gated capabilities resolved from the user's plan. */
export enum PlanFeature {
  ADVANCED_FILTERS = 'ADVANCED_FILTERS',
  EARLY_JOB_ACCESS = 'EARLY_JOB_ACCESS',
  COMPANY_INSIGHTS = 'COMPANY_INSIGHTS',
  APPLICATION_ANALYTICS = 'APPLICATION_ANALYTICS',
  INSTANT_ALERTS = 'INSTANT_ALERTS',
}

export enum JobSortBy {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
  SALARY_DESC = 'SALARY_DESC',
  SALARY_ASC = 'SALARY_ASC',
  RELEVANCE = 'RELEVANCE',
}

/** Ordering for the user's own AI evaluations list. */
export enum EvaluationSortBy {
  SCORE_DESC = 'SCORE_DESC',
  SCORE_ASC = 'SCORE_ASC',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}
