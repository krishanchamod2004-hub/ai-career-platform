import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { AiCredentials, AtsScore, Resume, ResumeSummary } from '@ai-career/shared';
import { UserRole } from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { AiProviderRegistry } from '../evaluations/ai/ai-provider.registry';
import { extractResumeText } from './resume-pdf.parser';
import { buildAtsScoreSystemPrompt, buildAtsScoreUserPrompt } from './prompts/ats-score.prompt';
import { parseAtsScoreResponse } from './ats-score-response.parser';
import { toAtsScore, toResume, toResumeSummary } from './resumes.mapper';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — generous for a text-based PDF resume.

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly providers: AiProviderRegistry,
    config: ConfigService,
  ) {
    // Local disk is an MVP choice: fine for a single API instance, but a
    // multi-replica deployment needs shared/object storage (S3 or equivalent)
    // since an upload landing on instance A must be readable from instance B.
    this.uploadDir = config.get<string>('RESUME_UPLOAD_DIR', './uploads/resumes');
  }

  async list(userId: string): Promise<ResumeSummary[]> {
    const rows = await this.prisma.resume.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toResumeSummary);
  }

  async findOne(userId: string, resumeId: string): Promise<Resume> {
    const row = await this.prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!row) {
      throw new NotFoundException('Resume not found');
    }
    return toResume(row);
  }

  /**
   * Extracts text from the uploaded PDF and persists both the text and the
   * original file. Free-plan cap is enforced before either the parse or the
   * disk write, so a rejected upload never leaves an orphaned file behind.
   */
  async upload(
    userId: string,
    file: { buffer: Buffer; originalname: string; size: number; mimetype: string },
    input: { title?: string; isDefault?: boolean },
  ): Promise<Resume> {
    if (file.mimetype !== 'application/pdf') {
      throw new UnprocessableEntityException('Only PDF files are supported.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new UnprocessableEntityException('PDF must be 10MB or smaller.');
    }

    const currentCount = await this.prisma.resume.count({ where: { userId } });
    await this.billing.assertWithinLimit(userId, 'maxResumes', currentCount);

    const content = await extractResumeText(file.buffer);
    const fileUrl = await this.storeFile(userId, file.buffer);
    const title = input.title?.trim() || this.deriveTitle(file.originalname);
    const isDefault = input.isDefault ?? currentCount === 0;

    if (isDefault) {
      await this.prisma.resume.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const row = await this.prisma.resume.create({
      data: { userId, title, content, fileUrl, isDefault },
    });

    this.logger.log(`User ${userId} uploaded resume "${title}" (${content.length} chars extracted)`);
    return toResume(row);
  }

  async update(
    userId: string,
    resumeId: string,
    input: { title?: string; isDefault?: boolean },
  ): Promise<Resume> {
    const existing = await this.prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!existing) {
      throw new NotFoundException('Resume not found');
    }

    if (input.isDefault) {
      await this.prisma.resume.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const row = await this.prisma.resume.update({
      where: { id: resumeId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
    return toResume(row);
  }

  async remove(userId: string, resumeId: string): Promise<{ message: string }> {
    const existing = await this.prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!existing) {
      throw new NotFoundException('Resume not found');
    }
    await this.prisma.resume.delete({ where: { id: resumeId } });
    if (existing.fileUrl) {
      await this.deleteFileQuietly(existing.fileUrl);
    }
    return { message: 'Resume deleted' };
  }

  /** Absolute path to the stored PDF, for the authenticated download route. */
  async resolveFilePath(userId: string, resumeId: string): Promise<{ path: string; title: string }> {
    const row = await this.prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!row || !row.fileUrl) {
      throw new NotFoundException('Resume file not found');
    }
    return { path: path.join(this.uploadDir, row.fileUrl), title: row.title };
  }

  /**
   * Grades one resume against one job with the user's own LLM key.
   *
   * Same cost-control policy as job evaluations: one row per (resume, job),
   * and an existing score is returned untouched unless `force` is set — the
   * user pays per call, so re-billing them for a score already on file is a bug.
   */
  async scoreAts(
    user: AuthenticatedUser,
    resumeId: string,
    jobId: string,
    credentials: AiCredentials,
    options: { force?: boolean } = {},
  ): Promise<AtsScore> {
    const userId = user.id;
    const resume = await this.prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        description: true,
        skills: true,
        earlyAccessUntil: true,
        company: { select: { name: true } },
      },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    await this.assertJobVisible(user, job.earlyAccessUntil);

    if (!options.force) {
      const existing = await this.prisma.atsScore.findUnique({
        where: { resumeId_jobId: { resumeId, jobId } },
      });
      if (existing && existing.userId === userId) {
        return toAtsScore(existing, { cached: true });
      }
    }

    await this.assertWithinMonthlyAtsQuota(userId);

    const client = this.providers.get(credentials.provider);
    const model = credentials.model?.trim() || client.defaultModel;

    const startedAt = Date.now();
    const completion = await client.complete({
      apiKey: credentials.apiKey,
      model,
      system: buildAtsScoreSystemPrompt(),
      prompt: buildAtsScoreUserPrompt({
        job: {
          title: job.title,
          companyName: job.company?.name ?? null,
          skills: job.skills,
          description: job.description,
        },
        resumeText: resume.content,
      }),
    });
    const durationMs = Date.now() - startedAt;

    const parsed = parseAtsScoreResponse(completion.text);

    this.logger.log(
      `ATS score for resume ${resumeId} vs job ${jobId} (user ${userId}) via ` +
        `${credentials.provider}/${completion.model}: ${parsed.score} in ${durationMs}ms`,
    );

    const data = {
      score: parsed.score,
      missingKeywords: parsed.missingKeywords,
      suggestions: parsed.suggestions,
      provider: credentials.provider,
      model: completion.model || model,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      durationMs,
    };

    const row = await this.prisma.atsScore.upsert({
      where: { resumeId_jobId: { resumeId, jobId } },
      create: { userId, resumeId, jobId, ...data },
      update: { userId, ...data },
    });

    return toAtsScore(row, { cached: false });
  }

  async findAtsScore(userId: string, resumeId: string, jobId: string): Promise<AtsScore> {
    const row = await this.prisma.atsScore.findUnique({ where: { resumeId_jobId: { resumeId, jobId } } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('This resume has not been scored against this job yet');
    }
    return toAtsScore(row, { cached: true });
  }

  /**
   * Free-plan monthly ATS-check cap. Counted from `AtsScore` rows rather than a
   * separate usage counter — the same simplicity trade-off `DailyStat` and
   * `BillingService.getEntitlements` already make elsewhere in this codebase.
   */
  private async assertWithinMonthlyAtsQuota(userId: string): Promise<void> {
    const limits = await this.billing.getLimits(userId);
    if (limits.maxAtsChecksPerMonth === null) {
      return;
    }
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usedThisMonth = await this.prisma.atsScore.count({
      where: { userId, createdAt: { gte: startOfMonth } },
    });
    await this.billing.assertWithinLimit(userId, 'maxAtsChecksPerMonth', usedThisMonth);
  }

  /**
   * Embargoed listings stay embargoed here too — same rationale as
   * EvaluationsService.assertJobVisible: an ATS check would otherwise work as
   * an oracle for job content the caller's plan has not unlocked.
   */
  private async assertJobVisible(
    user: AuthenticatedUser,
    earlyAccessUntil: Date | null,
  ): Promise<void> {
    if (!earlyAccessUntil || user.role === UserRole.ADMIN) {
      return;
    }
    const earlyAccessHours = await this.billing.getEarlyAccessHours(user.id);
    const threshold = new Date(Date.now() + earlyAccessHours * 3600 * 1000);
    if (earlyAccessUntil > threshold) {
      throw new ForbiddenException({
        message: 'This listing is in early access. Upgrade your plan to check your resume against it.',
        error: 'PLAN_UPGRADE_REQUIRED',
      });
    }
  }

  private deriveTitle(originalName: string): string {
    const withoutExt = originalName.replace(/\.pdf$/i, '');
    return withoutExt.trim().length > 0 ? withoutExt.trim().slice(0, 120) : 'Resume';
  }

  private async storeFile(userId: string, buffer: Buffer): Promise<string> {
    const filename = `${userId}-${randomUUID()}.pdf`;
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.writeFile(path.join(this.uploadDir, filename), buffer);
    return filename;
  }

  private async deleteFileQuietly(filename: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.uploadDir, filename));
    } catch (error) {
      this.logger.warn(`Failed to delete resume file ${filename}: ${(error as Error).message}`);
    }
  }
}
