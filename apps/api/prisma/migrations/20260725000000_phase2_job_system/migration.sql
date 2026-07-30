-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');

-- CreateEnum
CREATE TYPE "WorkLocationType" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('INTERNSHIP', 'ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'FILLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobSourceType" AS ENUM ('GREENHOUSE', 'LEVER', 'REMOTEOK', 'MANUAL');

-- CreateEnum
CREATE TYPE "ScraperRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ScraperTrigger" AS ENUM ('CRON', 'MANUAL', 'BACKFILL');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlertFrequency" AS ENUM ('INSTANT', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MATCHING_JOBS', 'JOB_ALERT_DIGEST', 'APPLICATION_REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_active_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website_url" TEXT,
    "logo_url" TEXT,
    "industry" TEXT,
    "company_size" TEXT,
    "headquarters" TEXT,
    "linkedin_url" TEXT,
    "founded_year" INTEGER,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_sources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JobSourceType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cron_expression" TEXT NOT NULL DEFAULT '0 */6 * * *',
    "requests_per_minute" INTEGER NOT NULL DEFAULT 60,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "description_html" TEXT,
    "company_id" TEXT,
    "source_id" TEXT,
    "source_job_id" TEXT,
    "external_url" TEXT,
    "apply_url" TEXT,
    "location" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "work_model" "WorkLocationType",
    "job_type" "JobType",
    "experience_level" "ExperienceLevel",
    "min_years_experience" INTEGER,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "salary_currency" TEXT,
    "salary_period" "SalaryPeriod",
    "salary_text" TEXT,
    "visa_sponsorship" BOOLEAN,
    "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "posted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "early_access_until" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "save_count" INTEGER NOT NULL DEFAULT 0,
    "application_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "job_types" "JobType"[] DEFAULT ARRAY[]::"JobType"[],
    "work_models" "WorkLocationType"[] DEFAULT ARRAY[]::"WorkLocationType"[],
    "experience_levels" "ExperienceLevel"[] DEFAULT ARRAY[]::"ExperienceLevel"[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "salary_min" INTEGER,
    "is_remote_only" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "AlertFrequency" NOT NULL DEFAULT 'DAILY',
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "last_matched_job_at" TIMESTAMP(3),
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "job_title" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "job_url" TEXT,
    "location" TEXT,
    "salary_note" TEXT,
    "resume_url" TEXT,
    "cover_letter" TEXT,
    "notes" TEXT,
    "applied_at" TIMESTAMP(3),
    "next_action_at" TIMESTAMP(3),
    "next_action_note" TEXT,
    "reminder_sent_at" TIMESTAMP(3),
    "board_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "dedupe_key" TEXT,
    "read_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_ends_at" TIMESTAMP(3),
    "provider" TEXT,
    "external_customer_id" TEXT,
    "external_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_runs" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" "ScraperRunStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "ScraperTrigger" NOT NULL DEFAULT 'CRON',
    "queue_job_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "jobs_found" INTEGER NOT NULL DEFAULT 0,
    "jobs_created" INTEGER NOT NULL DEFAULT 0,
    "jobs_updated" INTEGER NOT NULL DEFAULT 0,
    "jobs_skipped" INTEGER NOT NULL DEFAULT 0,
    "jobs_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "scraper_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_logs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT,
    "source_id" TEXT,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraper_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "scope" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_jobs" INTEGER NOT NULL DEFAULT 0,
    "active_jobs" INTEGER NOT NULL DEFAULT 0,
    "new_jobs" INTEGER NOT NULL DEFAULT 0,
    "total_companies" INTEGER NOT NULL DEFAULT 0,
    "new_users" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "saved_jobs" INTEGER NOT NULL DEFAULT 0,
    "applications" INTEGER NOT NULL DEFAULT 0,
    "scraper_runs" INTEGER NOT NULL DEFAULT 0,
    "scraper_failures" INTEGER NOT NULL DEFAULT 0,
    "notifications_sent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "job_sources_slug_key" ON "job_sources"("slug");

-- CreateIndex
CREATE INDEX "job_sources_is_enabled_idx" ON "job_sources"("is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedupe_key_key" ON "jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "jobs_status_posted_at_idx" ON "jobs"("status", "posted_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_status_created_at_idx" ON "jobs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_company_id_idx" ON "jobs"("company_id");

-- CreateIndex
CREATE INDEX "jobs_source_id_idx" ON "jobs"("source_id");

-- CreateIndex
CREATE INDEX "jobs_is_remote_idx" ON "jobs"("is_remote");

-- CreateIndex
CREATE INDEX "jobs_job_type_idx" ON "jobs"("job_type");

-- CreateIndex
CREATE INDEX "jobs_experience_level_idx" ON "jobs"("experience_level");

-- CreateIndex
CREATE INDEX "jobs_salary_max_idx" ON "jobs"("salary_max");

-- CreateIndex
CREATE INDEX "jobs_early_access_until_idx" ON "jobs"("early_access_until");

-- CreateIndex
CREATE INDEX "jobs_last_seen_at_idx" ON "jobs"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_source_id_source_job_id_key" ON "jobs"("source_id", "source_job_id");

-- CreateIndex
CREATE INDEX "saved_jobs_user_id_created_at_idx" ON "saved_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "saved_jobs_user_id_job_id_key" ON "saved_jobs"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "job_alerts_user_id_idx" ON "job_alerts"("user_id");

-- CreateIndex
CREATE INDEX "job_alerts_is_active_frequency_idx" ON "job_alerts"("is_active", "frequency");

-- CreateIndex
CREATE INDEX "applications_user_id_status_idx" ON "applications"("user_id", "status");

-- CreateIndex
CREATE INDEX "applications_next_action_at_idx" ON "applications"("next_action_at");

-- CreateIndex
CREATE UNIQUE INDEX "applications_user_id_job_id_key" ON "applications"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "application_events_application_id_created_at_idx" ON "application_events"("application_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_status_idx" ON "subscriptions"("plan", "status");

-- CreateIndex
CREATE INDEX "scraper_runs_source_id_started_at_idx" ON "scraper_runs"("source_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "scraper_runs_status_started_at_idx" ON "scraper_runs"("status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "scraper_logs_run_id_idx" ON "scraper_logs"("run_id");

-- CreateIndex
CREATE INDEX "scraper_logs_level_created_at_idx" ON "scraper_logs"("level", "created_at" DESC);

-- CreateIndex
CREATE INDEX "system_logs_level_created_at_idx" ON "system_logs"("level", "created_at" DESC);

-- CreateIndex
CREATE INDEX "system_logs_scope_idx" ON "system_logs"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_date_key" ON "daily_stats"("date");

-- CreateIndex
CREATE INDEX "users_last_active_at_idx" ON "users"("last_active_at");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "job_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_alerts" ADD CONSTRAINT "job_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraper_runs" ADD CONSTRAINT "scraper_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "job_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraper_logs" ADD CONSTRAINT "scraper_logs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "scraper_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraper_logs" ADD CONSTRAINT "scraper_logs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "job_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Keyword search support -------------------------------------------------------
-- Job search uses case-insensitive substring matching across title/company/description.
-- Trigram GIN indexes keep those ILIKE predicates index-backed instead of sequential.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "jobs_title_trgm_idx" ON "jobs" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "companies_name_trgm_idx" ON "companies" USING GIN ("name" gin_trgm_ops);

-- Array containment filters (skills[] / benefits[]).
CREATE INDEX "jobs_skills_gin_idx" ON "jobs" USING GIN ("skills");
