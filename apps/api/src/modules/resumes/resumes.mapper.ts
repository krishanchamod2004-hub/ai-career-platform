import type { Prisma } from '@prisma/client';
import type { AiProvider, AtsScore as AtsScoreDto, Resume, ResumeSummary } from '@ai-career/shared';

export type ResumeRow = Prisma.ResumeGetPayload<true>;
export type AtsScoreRow = Prisma.AtsScoreGetPayload<true>;

export function toResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    fileUrl: row.fileUrl,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Drops `content` — list views don't need several KB of resume text per row. */
export function toResumeSummary(row: ResumeRow): ResumeSummary {
  const { content: _content, ...rest } = toResume(row);
  return rest;
}

export function toAtsScore(row: AtsScoreRow, options: { cached?: boolean } = {}): AtsScoreDto {
  return {
    id: row.id,
    userId: row.userId,
    resumeId: row.resumeId,
    jobId: row.jobId,
    score: row.score,
    missingKeywords: row.missingKeywords,
    suggestions: row.suggestions,
    provider: row.provider as AiProvider,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
    cached: options.cached,
  };
}
