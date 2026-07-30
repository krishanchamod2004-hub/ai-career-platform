import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EARLY_ACCESS_WINDOW_HOURS, JobStatus } from '@ai-career/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { CleanJob, IngestionResult } from '../scraper.types';

const CONCURRENCY = 5;

/**
 * Stage 5 of the pipeline: persistence.
 *
 * Upsert strategy, in priority order:
 *   1. `dedupeKey` (unique)          — same role, possibly from another source
 *   2. `sourceId + sourceJobId`      — same posting from the same source
 * Unchanged rows only get `lastSeenAt` touched, which keeps write volume
 * proportional to real churn rather than crawl frequency.
 */
@Injectable()
export class JobIngestionService {
  private readonly logger = new Logger(JobIngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(jobs: CleanJob[], sourceId: string | null): Promise<IngestionResult> {
    const result: IngestionResult = { created: [], updated: [], skipped: 0, failed: 0 };
    const companyCache = new Map<string, string>();

    for (let index = 0; index < jobs.length; index += CONCURRENCY) {
      const batch = jobs.slice(index, index + CONCURRENCY);
      const outcomes = await Promise.all(
        batch.map(async (job) => {
          try {
            return await this.upsertJob(job, sourceId, companyCache);
          } catch (error) {
            this.logger.warn(
              `Failed to ingest "${job.title}" @ ${job.companyName}: ${(error as Error).message}`,
            );
            return { kind: 'failed' as const };
          }
        }),
      );

      for (const outcome of outcomes) {
        if (outcome.kind === 'created') result.created.push(outcome.id);
        else if (outcome.kind === 'updated') result.updated.push(outcome.id);
        else if (outcome.kind === 'skipped') result.skipped += 1;
        else result.failed += 1;
      }
    }

    return result;
  }

  private async upsertJob(
    job: CleanJob,
    sourceId: string | null,
    companyCache: Map<string, string>,
  ): Promise<{ kind: 'created' | 'updated' | 'skipped'; id: string } | { kind: 'failed' }> {
    const companyId = await this.resolveCompanyId(job, companyCache);

    const existing = await this.prisma.job.findFirst({
      where: {
        OR: [
          { dedupeKey: job.dedupeKey },
          ...(sourceId && job.sourceJobId ? [{ sourceId, sourceJobId: job.sourceJobId }] : []),
        ],
      },
      select: { id: true, contentHash: true, status: true },
    });

    const now = new Date();

    if (existing) {
      if (existing.contentHash === job.contentHash && existing.status === JobStatus.ACTIVE) {
        await this.prisma.job.update({
          where: { id: existing.id },
          data: { lastSeenAt: now },
        });
        return { kind: 'skipped', id: existing.id };
      }

      await this.prisma.job.update({
        where: { id: existing.id },
        data: {
          ...this.toWriteData(job, companyId, sourceId),
          // A posting seen again is live again, even if previously expired.
          status: JobStatus.ACTIVE,
          lastSeenAt: now,
          fetchedAt: now,
        },
      });
      return { kind: 'updated', id: existing.id };
    }

    try {
      const created = await this.prisma.job.create({
        data: {
          ...this.toWriteData(job, companyId, sourceId),
          slug: job.slug,
          dedupeKey: job.dedupeKey,
          status: JobStatus.ACTIVE,
          fetchedAt: now,
          lastSeenAt: now,
          // Premium/Pro plans see brand-new listings before free users do.
          earlyAccessUntil: new Date(now.getTime() + EARLY_ACCESS_WINDOW_HOURS * 3600 * 1000),
        },
        select: { id: true },
      });
      return { kind: 'created', id: created.id };
    } catch (error) {
      // Concurrent workers can race on either unique constraint; resolve to an update.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const conflicting = await this.prisma.job.findUnique({
          where: { dedupeKey: job.dedupeKey },
          select: { id: true },
        });
        if (conflicting) {
          await this.prisma.job.update({
            where: { id: conflicting.id },
            data: { ...this.toWriteData(job, companyId, sourceId), lastSeenAt: now },
          });
          return { kind: 'updated', id: conflicting.id };
        }
      }
      throw error;
    }
  }

  private toWriteData(
    job: CleanJob,
    companyId: string,
    sourceId: string | null,
  ): Prisma.JobUncheckedUpdateInput & Prisma.JobUncheckedCreateInput {
    return {
      title: job.title,
      description: job.description,
      descriptionHtml: job.descriptionHtml,
      companyId,
      sourceId,
      sourceJobId: job.sourceJobId,
      externalUrl: job.url,
      applyUrl: job.applyUrl ?? job.url,
      location: job.location,
      city: job.city,
      region: job.region,
      country: job.country,
      isRemote: job.isRemote,
      workModel: job.workModel,
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      minYearsExperience: job.minYearsExperience,
      skills: job.skills,
      benefits: job.benefits,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      salaryPeriod: job.salaryPeriod,
      salaryText: job.salaryText,
      visaSponsorship: job.visaSponsorship,
      postedAt: job.postedAt ?? new Date(),
      contentHash: job.contentHash,
      slug: job.slug,
      dedupeKey: job.dedupeKey,
    };
  }

  /** Companies are keyed by slug; logo/website are backfilled when first discovered. */
  private async resolveCompanyId(
    job: CleanJob,
    cache: Map<string, string>,
  ): Promise<string> {
    const cached = cache.get(job.companySlug);
    if (cached) {
      return cached;
    }

    const company = await this.prisma.company.upsert({
      where: { slug: job.companySlug },
      update: {
        ...(job.companyLogoUrl ? { logoUrl: job.companyLogoUrl } : {}),
        ...(job.companyWebsite ? { websiteUrl: job.companyWebsite } : {}),
      },
      create: {
        slug: job.companySlug,
        name: job.companyName,
        logoUrl: job.companyLogoUrl,
        websiteUrl: job.companyWebsite,
      },
      select: { id: true },
    });

    cache.set(job.companySlug, company.id);
    return company.id;
  }
}
