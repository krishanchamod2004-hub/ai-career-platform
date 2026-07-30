import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  JobStatus,
  LogLevel,
  PlanTier,
  ScraperRunStatus,
  UserRole,
  type AdminUserListItem,
  type PaginatedResponse,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { ScraperService } from '../scraper/services/scraper.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../../common/pagination/pagination.util';
import type {
  AdminListLogsDto,
  AdminListRunsDto,
  AdminListUsersDto,
  AdminUpdateCompanyDto,
  AdminUpdateJobDto,
  UpdateUserPlanDto,
} from './dto/admin.dto';

/**
 * Back-office operations. Every route that reaches this service is guarded by
 * @Roles(UserRole.ADMIN); nothing here performs its own authorization.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly scraper: ScraperService,
  ) {}

  // --- users ---------------------------------------------------------------

  async listUsers(query: AdminListUsersDto): Promise<PaginatedResponse<AdminUserListItem>> {
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);
    const where: Prisma.UserWhereInput = {
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.plan ? { subscription: { plan: query.plan } } : {}),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
          lastActiveAt: true,
          subscription: { select: { plan: true } },
          _count: { select: { savedJobs: true, applications: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items: AdminUserListItem[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      plan: row.subscription?.plan ?? PlanTier.FREE,
      isEmailVerified: row.isEmailVerified,
      savedJobCount: row._count.savedJobs,
      applicationCount: row._count.applications,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    }));

    return buildPaginatedResponse(items, totalItems, page, pageSize);
  }

  async updateUserRole(userId: string, role: UserRole) {
    await this.assertUserExists(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });
  }

  /** Manual plan grant — the seam a billing webhook will replace. */
  async updateUserPlan(userId: string, dto: UpdateUserPlanDto) {
    await this.assertUserExists(userId);
    return this.billing.setPlan(userId, dto.plan, {
      status: dto.status,
      periodDays: dto.periodDays,
    });
  }

  // --- jobs & companies ----------------------------------------------------

  async listJobs(query: {
    q?: string;
    status?: JobStatus;
    sourceId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);
    const where: Prisma.JobWhereInput = {
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          isRemote: true,
          postedAt: true,
          createdAt: true,
          lastSeenAt: true,
          earlyAccessUntil: true,
          viewCount: true,
          saveCount: true,
          applicationCount: true,
          company: { select: { id: true, name: true } },
          source: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalItems, page, pageSize);
  }

  async updateJob(id: string, dto: AdminUpdateJobDto) {
    const job = await this.prisma.job.findUnique({ where: { id }, select: { id: true } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return this.prisma.job.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.clearEarlyAccess ? { earlyAccessUntil: null } : {}),
      },
    });
  }

  async deleteJob(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, select: { id: true } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    await this.prisma.job.delete({ where: { id } });
    return { message: 'Job deleted' };
  }

  async listCompanies(query: { q?: string; page?: number; pageSize?: number }) {
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);
    const where: Prisma.CompanyWhereInput = query.q
      ? { name: { contains: query.q, mode: 'insensitive' } }
      : {};

    const [items, totalItems] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { jobs: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalItems, page, pageSize);
  }

  async updateCompany(id: string, dto: AdminUpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return this.prisma.company.update({ where: { id }, data: { ...dto } });
  }

  // --- scraper observability ----------------------------------------------

  getScraperStatus() {
    return this.scraper.getSourceHealth();
  }

  async listRuns(query: AdminListRunsDto) {
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);
    const where: Prisma.ScraperRunWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.scraperRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { source: { select: { slug: true, name: true, type: true } } },
      }),
      this.prisma.scraperRun.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalItems, page, pageSize);
  }

  /** Failed runs, newest first — the triage queue for the admin dashboard. */
  listFailedRuns(query: AdminListRunsDto) {
    return this.listRuns({ ...query, status: ScraperRunStatus.FAILED });
  }

  async retryRun(runId: string) {
    const run = await this.prisma.scraperRun.findUnique({
      where: { id: runId },
      select: { sourceId: true },
    });
    if (!run) {
      throw new NotFoundException('Scraper run not found');
    }
    return this.scraper.triggerSource(run.sourceId);
  }

  async listLogs(query: AdminListLogsDto) {
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);

    if (query.channel === 'system') {
      const where: Prisma.SystemLogWhereInput = query.level ? { level: query.level } : {};
      const [items, totalItems] = await Promise.all([
        this.prisma.systemLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.systemLog.count({ where }),
      ]);
      return buildPaginatedResponse(items, totalItems, page, pageSize);
    }

    const where: Prisma.ScraperLogWhereInput = {
      ...(query.level ? { level: query.level } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
    };
    const [items, totalItems] = await Promise.all([
      this.prisma.scraperLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { source: { select: { slug: true, name: true } } },
      }),
      this.prisma.scraperLog.count({ where }),
    ]);
    return buildPaginatedResponse(items, totalItems, page, pageSize);
  }

  /** Counters for the admin landing page. */
  async getDashboardSummary() {
    const since24h = new Date(Date.now() - 24 * 3600 * 1000);
    const [enabledSources, failedRuns24h, errorLogs24h, expiredJobs] = await Promise.all([
      this.prisma.jobSource.count({ where: { isEnabled: true } }),
      this.prisma.scraperRun.count({
        where: { status: ScraperRunStatus.FAILED, startedAt: { gte: since24h } },
      }),
      this.prisma.scraperLog.count({
        where: { level: LogLevel.ERROR, createdAt: { gte: since24h } },
      }),
      this.prisma.job.count({ where: { status: JobStatus.EXPIRED } }),
    ]);

    return { enabledSources, failedRuns24h, errorLogs24h, expiredJobs };
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }
}
