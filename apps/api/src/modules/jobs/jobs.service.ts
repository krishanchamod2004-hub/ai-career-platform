import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  JobSortBy,
  JobStatus,
  PlanFeature,
  UserRole,
  type Job,
  type JobFacets,
  type JobListItem,
  type PaginatedResponse,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import {
  buildCursorFilter,
  buildJobOrderBy,
  buildJobWhere,
  buildNextCursor,
  supportsCursor,
} from './jobs.query-builder';
import {
  jobDetailInclude,
  jobListSelect,
  toJobDetail,
  toJobListItem,
  type JobListRow,
} from './jobs.mapper';
import { buildPaginatedResponse, normalizePagination } from '../../common/pagination/pagination.util';
import type { QueryJobsDto } from './dto/query-jobs.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

/** Filters reserved for plans holding ADVANCED_FILTERS. */
const PREMIUM_FILTER_KEYS: Array<keyof QueryJobsDto> = [
  'skills',
  'visaSponsorship',
  'sourceSlug',
  'country',
];

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  async search(
    query: QueryJobsDto,
    user?: AuthenticatedUser,
  ): Promise<PaginatedResponse<JobListItem>> {
    await this.assertFilterAccess(query, user);

    const earlyAccessHours = await this.billing.getEarlyAccessHours(user?.id ?? null);
    const now = new Date();
    const where = buildJobWhere(query, { earlyAccessHours, now });
    const orderBy = buildJobOrderBy(query.sortBy);
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);

    const useCursor = Boolean(query.cursor) && supportsCursor(query.sortBy);
    const effectiveWhere: Prisma.JobWhereInput = useCursor
      ? { AND: [where, buildCursorFilter(query.cursor as string, query.sortBy)] }
      : where;

    const [rows, totalItems] = await Promise.all([
      this.prisma.job.findMany({
        where: effectiveWhere,
        orderBy,
        select: jobListSelect,
        take: pageSize,
        ...(useCursor ? {} : { skip: (page - 1) * pageSize }),
      }),
      this.prisma.job.count({ where }),
    ]);

    const savedJobIds = await this.getSavedJobIds(user?.id, rows);
    const items = rows.map((row) => toJobListItem(row, { savedJobIds, now }));

    // Only emit a cursor when the page was full — otherwise the list is exhausted.
    const nextCursor =
      supportsCursor(query.sortBy) && rows.length === pageSize
        ? buildNextCursor(rows[rows.length - 1])
        : null;

    return buildPaginatedResponse(items, totalItems, page, pageSize, nextCursor);
  }

  /** Accepts either a UUID or a slug so URLs can stay human-readable. */
  async findOne(idOrSlug: string, user?: AuthenticatedUser): Promise<Job> {
    const row = await this.prisma.job.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: jobDetailInclude,
    });

    if (!row) {
      throw new NotFoundException('Job not found');
    }

    // Enforce early access on the detail route too, so a shared link cannot leak
    // an embargoed listing to a free account. Skipped in development for the
    // same reason as the list endpoint's equivalent check in jobs.query-builder.ts
    // — so newly-scraped jobs are viewable locally without waiting out the
    // embargo. Never applies outside NODE_ENV=development.
    const earlyAccessHours = await this.billing.getEarlyAccessHours(user?.id ?? null);
    const threshold = new Date(Date.now() + earlyAccessHours * 3600 * 1000);
    if (
      process.env.NODE_ENV !== 'development' &&
      user?.role !== UserRole.ADMIN &&
      row.earlyAccessUntil &&
      row.earlyAccessUntil > threshold
    ) {
      throw new ForbiddenException({
        message: 'This listing is in early access. Upgrade your plan to view it now.',
        error: 'PLAN_UPGRADE_REQUIRED',
        feature: PlanFeature.EARLY_JOB_ACCESS,
      });
    }

    // Fire-and-forget: a view counter must not slow down or fail the response.
    void this.prisma.job
      .update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    const [saved, application] = user
      ? await Promise.all([
          this.prisma.savedJob.findUnique({
            where: { userId_jobId: { userId: user.id, jobId: row.id } },
            select: { id: true },
          }),
          this.prisma.application.findFirst({
            where: { userId: user.id, jobId: row.id },
            select: { id: true },
          }),
        ])
      : [null, null];

    return toJobDetail(row, {
      isSaved: user ? Boolean(saved) : undefined,
      applicationId: application?.id ?? null,
    });
  }

  /** Related listings: same company or overlapping skills, freshest first. */
  async findSimilar(id: string, limit = 6, user?: AuthenticatedUser): Promise<JobListItem[]> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: { id: true, companyId: true, skills: true, experienceLevel: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const earlyAccessHours = await this.billing.getEarlyAccessHours(user?.id ?? null);
    const threshold = new Date(Date.now() + earlyAccessHours * 3600 * 1000);

    const rows = await this.prisma.job.findMany({
      where: {
        id: { not: job.id },
        status: JobStatus.ACTIVE,
        OR: [
          ...(job.companyId ? [{ companyId: job.companyId }] : []),
          ...(job.skills.length > 0 ? [{ skills: { hasSome: job.skills } }] : []),
          ...(job.experienceLevel ? [{ experienceLevel: job.experienceLevel }] : []),
        ],
        AND: [{ OR: [{ earlyAccessUntil: null }, { earlyAccessUntil: { lte: threshold } }] }],
      },
      orderBy: [{ postedAt: 'desc' }],
      select: jobListSelect,
      take: limit,
    });

    const savedJobIds = await this.getSavedJobIds(user?.id, rows);
    return rows.map((row) => toJobListItem(row, { savedJobIds }));
  }

  /** Counts used to label filter options in the UI. */
  async facets(query: QueryJobsDto, user?: AuthenticatedUser): Promise<JobFacets> {
    const earlyAccessHours = await this.billing.getEarlyAccessHours(user?.id ?? null);
    const where = buildJobWhere({ ...query, page: 1, cursor: undefined }, { earlyAccessHours });

    const [total, remoteCount, withSalaryCount, byJobType, byExperienceLevel] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.count({ where: { AND: [where, { isRemote: true }] } }),
      this.prisma.job.count({ where: { AND: [where, { salaryMin: { not: null } }] } }),
      this.prisma.job.groupBy({ by: ['jobType'], where, _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['experienceLevel'], where, _count: { _all: true } }),
    ]);

    return {
      total,
      remoteCount,
      withSalaryCount,
      byJobType: Object.fromEntries(
        byJobType.map((entry) => [entry.jobType ?? 'UNKNOWN', entry._count._all]),
      ),
      byExperienceLevel: Object.fromEntries(
        byExperienceLevel.map((entry) => [entry.experienceLevel ?? 'UNKNOWN', entry._count._all]),
      ),
    };
  }

  private async getSavedJobIds(
    userId: string | undefined,
    rows: JobListRow[],
  ): Promise<Set<string> | undefined> {
    if (!userId || rows.length === 0) {
      return undefined;
    }
    const saved = await this.prisma.savedJob.findMany({
      where: { userId, jobId: { in: rows.map((row) => row.id) } },
      select: { jobId: true },
    });
    return new Set(saved.map((entry) => entry.jobId));
  }

  /**
   * Advanced filters are a paid capability, so requesting one without the
   * entitlement fails loudly rather than silently returning unfiltered results.
   */
  private async assertFilterAccess(query: QueryJobsDto, user?: AuthenticatedUser): Promise<void> {
    const usesPremiumFilter = PREMIUM_FILTER_KEYS.some((key) => {
      const value = query[key];
      return Array.isArray(value) ? value.length > 0 : value !== undefined;
    });

    if (!usesPremiumFilter) {
      return;
    }
    if (user?.role === UserRole.ADMIN) {
      return;
    }
    if (!user) {
      throw new ForbiddenException({
        message: 'Advanced filters require a Pro or Premium plan.',
        error: 'PLAN_UPGRADE_REQUIRED',
        feature: PlanFeature.ADVANCED_FILTERS,
      });
    }
    await this.billing.assertFeature(user.id, PlanFeature.ADVANCED_FILTERS);
  }

  /** Sort options exposed to clients (kept here so Swagger and UI agree). */
  listSortOptions(): JobSortBy[] {
    return Object.values(JobSortBy);
  }
}
