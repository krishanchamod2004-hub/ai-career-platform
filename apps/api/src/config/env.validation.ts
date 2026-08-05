import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsInt()
  REFRESH_TOKEN_TTL_DAYS?: number;

  @IsString()
  GOOGLE_CLIENT_ID!: string;

  @IsString()
  GOOGLE_CLIENT_SECRET!: string;

  @IsString()
  GOOGLE_CALLBACK_URL!: string;

  @IsString()
  WEB_URL!: string;

  // --- JobSpy Scraper Sidecar -----------------------------------------------

  /** Base URL of the Python JobSpy service (services/jobspy). */
  @IsOptional()
  @IsString()
  JOBSPY_SERVICE_URL?: string;

  /** Shared authentication token between API and JobSpy service. */
  @IsOptional()
  @IsString()
  JOBSPY_API_TOKEN?: string;

  /** Request timeout for JobSpy (slightly above JobSpy's own timeout). */
  @IsOptional()
  @IsInt()
  @Min(1000)
  JOBSPY_TIMEOUT_MS?: number;

  // --- Phase 2: queues & workers -------------------------------------------

  /** BullMQ key prefix — isolates environments sharing one Redis instance. */
  @IsOptional()
  @IsString()
  QUEUE_PREFIX?: string;

  /** "true" registers cron schedules in this process (worker container only). */
  @IsOptional()
  @IsString()
  ENABLE_SCHEDULER?: string;

  /** "true" runs queue consumers inside the API process (local development). */
  @IsOptional()
  @IsString()
  RUN_WORKERS_IN_API?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  SCRAPER_CONCURRENCY?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  NOTIFICATIONS_CONCURRENCY?: number;

  /** Consecutive failures before a source is auto-disabled. */
  @IsOptional()
  @IsInt()
  @Min(1)
  SCRAPER_MAX_CONSECUTIVE_FAILURES?: number;

  /** Days without being seen in its source before a job is marked EXPIRED. */
  @IsOptional()
  @IsInt()
  @Min(1)
  JOB_STALE_DAYS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  LOG_RETENTION_DAYS?: number;

  // --- Phase 2: cron expressions (optional overrides) ----------------------

  @IsOptional()
  @IsString()
  CRON_DAILY_DIGEST?: string;

  @IsOptional()
  @IsString()
  CRON_WEEKLY_DIGEST?: string;

  @IsOptional()
  @IsString()
  CRON_EXPIRE_JOBS?: string;

  @IsOptional()
  @IsString()
  CRON_DAILY_STATS?: string;

  @IsOptional()
  @IsString()
  CRON_APPLICATION_REMINDERS?: string;

  @IsOptional()
  @IsString()
  CRON_PRUNE_LOGS?: string;

  // --- Phase 3: AI evaluations (BYOK — no vendor keys live here) ------------

  /** Per-request timeout for LLM calls. */
  @IsOptional()
  @IsInt()
  @Min(1000)
  AI_REQUEST_TIMEOUT_MS?: number;

  /** Output token ceiling; the rubric response fits comfortably in ~1.2k. */
  @IsOptional()
  @IsInt()
  @Min(256)
  AI_MAX_OUTPUT_TOKENS?: number;

  /** Total attempts per evaluation. Kept at 2: every attempt bills the user. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  AI_MAX_ATTEMPTS?: number;

  // --- Resumes / ATS scoring -------------------------------------------------

  /** Local-disk directory for uploaded resume PDFs (MVP; see ResumesService). */
  @IsOptional()
  @IsString()
  RESUME_UPLOAD_DIR?: string;

  // --- Billing: Lemon Squeezy ------------------------------------------------
  // All optional: the API must still boot (auth, jobs, evaluations) on a
  // deployment with no billing connected. LemonSqueezyConfig reports
  // isConfigured=false and the checkout/webhook routes answer 503 instead.

  /** Lemon Squeezy API key (store-scoped). Server-side only — never sent to the browser. */
  @IsOptional()
  @IsString()
  LEMON_SQUEEZY_API_KEY?: string;

  @IsOptional()
  @IsString()
  LEMON_SQUEEZY_STORE_ID?: string;

  /** Signing secret for the webhook HMAC. Without it, webhooks are rejected. */
  @IsOptional()
  @IsString()
  LEMON_SQUEEZY_WEBHOOK_SECRET?: string;

  /** Variant id purchased for the PRO tier. Unmapped variants grant nothing. */
  @IsOptional()
  @IsString()
  LEMON_SQUEEZY_VARIANT_ID_PRO?: string;

  @IsOptional()
  @IsString()
  LEMON_SQUEEZY_VARIANT_ID_PREMIUM?: string;
}

/**
 * Fails fast at boot if required environment variables are missing/invalid,
 * instead of surfacing cryptic errors deep in request handling.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }
  return validatedConfig;
}
