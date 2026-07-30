-- Phase 3 (step 1): JobSpy-backed job sources + AI job evaluations.
--
-- Additive only: no existing column, index or row is altered or dropped, so this
-- migration is safe to apply to a database that already holds Phase 2 data.

-- AlterEnum
-- Postgres 12+ permits ALTER TYPE ... ADD VALUE inside a transaction as long as
-- the new values are not referenced by the same transaction; nothing below uses
-- them, so this is safe under Prisma's transactional migration runner.
ALTER TYPE "JobSourceType" ADD VALUE 'LINKEDIN';
ALTER TYPE "JobSourceType" ADD VALUE 'INDEED';
ALTER TYPE "JobSourceType" ADD VALUE 'GLASSDOOR';
ALTER TYPE "JobSourceType" ADD VALUE 'ZIPRECRUITER';

-- CreateEnum
CREATE TYPE "EvaluationGrade" AS ENUM ('A', 'B', 'C', 'D', 'F');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- CreateTable
CREATE TABLE "job_evaluations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "grade" "EvaluationGrade" NOT NULL,
    "rubric" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gaps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_evaluations_user_id_job_id_key" ON "job_evaluations"("user_id", "job_id");

-- CreateIndex
-- "My best-scoring jobs" is the primary dashboard query.
CREATE INDEX "job_evaluations_user_id_score_idx" ON "job_evaluations"("user_id", "score" DESC);

-- CreateIndex
CREATE INDEX "job_evaluations_job_id_idx" ON "job_evaluations"("job_id");

-- AddForeignKey
ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guard rail Prisma cannot express in schema.prisma: an LLM that returns 0, 11
-- or NaN is a real failure mode, and a bad score must never reach the UI.
ALTER TABLE "job_evaluations"
    ADD CONSTRAINT "job_evaluations_score_range_check"
    CHECK ("score" >= 1.0 AND "score" <= 5.0);
