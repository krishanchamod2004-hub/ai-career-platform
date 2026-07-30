import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  JobStatus,
  PlanFeature,
  UserRole,
  type Company,
  type CompanyInsights,
  type CompanyWithStats,
  type PaginatedResponse,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../../common/pagination/pagination.util';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  async list(params: {
    q?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<CompanyWithStats>> {
    const { page, pageSize } = normalizePagination(params.page, params.pageSize);
    const where: Prisma.CompanyWhereInput = params.q
      ? { name: { contains: params.q.trim(), mode: 'insensitive' } }
      : {};

    const [rows, totalItems] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { jobs: { where: { status: JobStatus.ACTIVE } } } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    const items = rows.map((row) => ({
      ...this.toCompany(row),
      openJobCount: row._count.jobs,
    }));

    return buildPaginatedResponse(items, totalItems, page, pageSize);
  }

  /**
   * Company profile. Deep hiring intelligence (salary averages, hiring velocity,
   * top skills) is a Premium capability, so it is attached only when the caller
   * holds COMPANY_INSIGHTS — the base profile stays public.
   */
  async findOne(idOrSlug: string, user?: AuthenticatedUser): Promise<CompanyWithStats> {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { _count: { select: { jobs: { where: { status: JobStatus.ACTIVE } } } } },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const canSeeInsights =
      user?.role === UserRole.ADMIN ||
      (user ? await this.billing.hasFeature(user.id, PlanFeature.COMPANY_INSIGHTS) : false);

    return {
      ...this.toCompany(company),
      openJobCount: company._count.jobs,
      ...(canSeeInsights ? { insights: await this.buildInsights(company.id) } : {}),
    };
  }

  /** Resolves either an id or a slug to the company id (404 when unknown). */
  async resolveId(idOrSlug: string): Promise<string> {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company.id;
  }

  private async buildInsights(companyId: string): Promise<CompanyInsights> {
    const last30Days = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const last90Days = new Date(Date.now() - 90 * 24 * 3600 * 1000);

    const [aggregate, remoteCount, totalActive, recentCount, quarterCount, skillRows] =
      await Promise.all([
        this.prisma.job.aggregate({
          where: { companyId, salaryMin: { not: null } },
          _avg: { salaryMin: true, salaryMax: true },
        }),
        this.prisma.job.count({ where: { companyId, isRemote: true, status: JobStatus.ACTIVE } }),
        this.prisma.job.count({ where: { companyId, status: JobStatus.ACTIVE } }),
        this.prisma.job.count({ where: { companyId, createdAt: { gte: last30Days } } }),
        this.prisma.job.count({ where: { companyId, createdAt: { gte: last90Days } } }),
        this.prisma.job.findMany({
          where: { companyId, status: JobStatus.ACTIVE },
          select: { skills: true },
          take: 200,
        }),
      ]);

    const skillCounts = new Map<string, number>();
    for (const row of skillRows) {
      for (const skill of row.skills) {
        skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
      }
    }

    return {
      avgSalaryMin: aggregate._avg.salaryMin ? Math.round(aggregate._avg.salaryMin) : null,
      avgSalaryMax: aggregate._avg.salaryMax ? Math.round(aggregate._avg.salaryMax) : null,
      remoteJobShare: totalActive === 0 ? 0 : Number((remoteCount / totalActive).toFixed(2)),
      jobsPostedLast30Days: recentCount,
      topSkills: [...skillCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([skill]) => skill),
      // Average new postings per month over the last quarter.
      hiringVelocity: Number((quarterCount / 3).toFixed(1)),
    };
  }

  private toCompany(row: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
    industry: string | null;
    companySize: string | null;
    headquarters: string | null;
    linkedinUrl: string | null;
    foundedYear: number | null;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Company {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      websiteUrl: row.websiteUrl,
      logoUrl: row.logoUrl,
      industry: row.industry,
      companySize: row.companySize,
      headquarters: row.headquarters,
      linkedinUrl: row.linkedinUrl,
      foundedYear: row.foundedYear,
      isVerified: row.isVerified,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
