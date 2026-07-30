import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AI_MODEL_OPTIONS,
  EvaluationGrade,
  EvaluationSortBy,
  PlanFeature,
  UserRole,
  type AiCredentials,
  type AiModelOption,
  type EvaluationSummary,
  type JobEvaluation,
  type JobEvaluationGrade,
  type PaginatedResponse,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../../common/pagination/pagination.util';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AiProviderRegistry } from './ai/ai-provider.registry';
import { parseEvaluationResponse } from './evaluation-response.parser';
import {
  buildEvaluationSystemPrompt,
  buildEvaluationUserPrompt,
  type CandidateProfileContext,
  type JobEvaluationContext,
} from './prompts/evaluation.prompt';
import {
  evaluationWithJobInclude,
  toJobEvaluation,
  type EvaluationRow,
} from './evaluations.mapper';
import type { QueryEvaluationsDto } from './dto/evaluate-job.dto';

/** Bound on the `grades` lookup so a crafted query cannot ask for the whole table. */
const MAX_GRADE_LOOKUP_IDS = 100;

const EMPTY_GRADE_COUNTS: Record<EvaluationGrade, number> = {
  [EvaluationGrade.A]: 0,
  [EvaluationGrade.B]: 0,
  [EvaluationGrade.C]: 0,
  [EvaluationGrade.D]: 0,
  [EvaluationGrade.F]: 0,
};

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly providers: AiProviderRegistry,
  ) {}

  /**
   * Scores one job for one user with the user's own LLM key, then persists the
   * result to `job_evaluations`.
   *
   * Cost control is deliberate: one row per (user, job), and an existing row is
   * returned untouched unless `force` is set. Users pay per call, so silently
   * re-billing them for a grade we already hold would be a bug, not a feature.
   */
  async evaluate(
    user: AuthenticatedUser,
    jobId: string,
    credentials: AiCredentials,
    options: { force?: boolean } = {},
  ): Promise<JobEvaluation> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        isRemote: true,
        workModel: true,
        jobType: true,
        experienceLevel: true,
        minYearsExperience: true,
        skills: true,
        benefits: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryPeriod: true,
        salaryText: true,
        visaSponsorship: true,
        earlyAccessUntil: true,
        company: { select: { name: true } },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    await this.assertJobVisible(user, job.earlyAccessUntil);

    if (!options.force) {
      const existing = await this.prisma.jobEvaluation.findUnique({
        where: { userId_jobId: { userId: user.id, jobId } },
        include: evaluationWithJobInclude,
      });
      if (existing) {
        return toJobEvaluation(existing, { cached: true });
      }
    }

    const profile = await this.loadProfileContext(user.id);
    const client = this.providers.get(credentials.provider);
    const model = credentials.model?.trim() || client.defaultModel;

    const jobContext: JobEvaluationContext = {
      title: job.title,
      companyName: job.company?.name ?? null,
      location: job.location,
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
      description: job.description,
    };

    const startedAt = Date.now();
    const completion = await client.complete({
      apiKey: credentials.apiKey,
      model,
      system: buildEvaluationSystemPrompt(),
      prompt: buildEvaluationUserPrompt({ job: jobContext, profile }),
    });
    const durationMs = Date.now() - startedAt;

    const parsed = parseEvaluationResponse(completion.text);

    this.logger.log(
      `Evaluated job ${jobId} for user ${user.id} via ${credentials.provider}/${completion.model}: ` +
        `${parsed.score.toFixed(1)} (${parsed.grade}) in ${durationMs}ms`,
    );

    const data = {
      score: parsed.score,
      grade: parsed.grade,
      rubric: parsed.rubric as unknown as Prisma.InputJsonValue,
      summary: parsed.summary,
      strengths: parsed.strengths,
      gaps: parsed.gaps,
      provider: credentials.provider,
      // Record what the vendor says it served, not what we asked for — aliases
      // like "gpt-4o" resolve to a dated snapshot, which is what auditing needs.
      model: completion.model || model,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      durationMs,
    };

    const row = await this.prisma.jobEvaluation.upsert({
      where: { userId_jobId: { userId: user.id, jobId } },
      create: { userId: user.id, jobId, ...data },
      update: data,
      include: evaluationWithJobInclude,
    });

    return toJobEvaluation(row, { cached: false });
  }

  async findForJob(userId: string, jobId: string): Promise<JobEvaluation> {
    const row = await this.prisma.jobEvaluation.findUnique({
      where: { userId_jobId: { userId, jobId } },
      include: evaluationWithJobInclude,
    });
    if (!row) {
      throw new NotFoundException('This job has not been evaluated yet');
    }
    return toJobEvaluation(row, { cached: true });
  }

  async list(
    userId: string,
    query: QueryEvaluationsDto,
  ): Promise<PaginatedResponse<JobEvaluation>> {
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);
    const where: Prisma.JobEvaluationWhereInput = {
      userId,
      ...(query.grade ? { grade: query.grade } : {}),
    };

    const [rows, totalItems, savedJobIds] = await Promise.all([
      this.prisma.jobEvaluation.findMany({
        where,
        orderBy: this.buildOrderBy(query.sortBy),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: evaluationWithJobInclude,
      }),
      this.prisma.jobEvaluation.count({ where }),
      this.prisma.savedJob.findMany({ where: { userId }, select: { jobId: true } }),
    ]);

    const savedSet = new Set(savedJobIds.map((entry) => entry.jobId));
    const items = (rows as EvaluationRow[]).map((row) =>
      toJobEvaluation(row, { savedJobIds: savedSet }),
    );

    return buildPaginatedResponse(items, totalItems, page, pageSize);
  }

  /**
   * Grade-only projection for badging job lists. Mirrors `/saved-jobs/ids`: the
   * feed needs a per-row badge, and shipping full evaluations for that would be
   * an order of magnitude more payload.
   */
  async listGrades(userId: string, jobIds?: string[]): Promise<JobEvaluationGrade[]> {
    const filter = jobIds && jobIds.length > 0 ? jobIds.slice(0, MAX_GRADE_LOOKUP_IDS) : undefined;

    const rows = await this.prisma.jobEvaluation.findMany({
      where: { userId, ...(filter ? { jobId: { in: filter } } : {}) },
      select: { jobId: true, score: true, grade: true },
      orderBy: { score: 'desc' },
      // Unfiltered callers (e.g. first paint of the feed) still get a bounded set.
      take: filter ? filter.length : MAX_GRADE_LOOKUP_IDS,
    });

    return rows.map((row) => ({
      jobId: row.jobId,
      score: row.score,
      grade: row.grade as EvaluationGrade,
    }));
  }

  async summarize(userId: string): Promise<EvaluationSummary> {
    const [grouped, aggregate] = await Promise.all([
      this.prisma.jobEvaluation.groupBy({
        by: ['grade'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.jobEvaluation.aggregate({
        where: { userId },
        _avg: { score: true },
        _count: { _all: true },
      }),
    ]);

    const byGrade = { ...EMPTY_GRADE_COUNTS };
    for (const entry of grouped) {
      byGrade[entry.grade as EvaluationGrade] = entry._count._all;
    }

    const average = aggregate._avg.score;
    return {
      total: aggregate._count._all,
      averageScore: average === null ? null : Math.round(average * 10) / 10,
      byGrade,
    };
  }

  async remove(userId: string, jobId: string): Promise<{ message: string }> {
    const existing = await this.prisma.jobEvaluation.findUnique({
      where: { userId_jobId: { userId, jobId } },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('This job has not been evaluated yet');
    }
    await this.prisma.jobEvaluation.delete({ where: { id: existing.id } });
    return { message: 'Evaluation deleted' };
  }

  /** Model catalog for the API-key modal. Free of user data, so cheap to serve. */
  listModels(): AiModelOption[] {
    const supported = this.providers.listProviders();
    return AI_MODEL_OPTIONS.filter((option) => supported.includes(option.provider));
  }

  private buildOrderBy(
    sortBy: EvaluationSortBy = EvaluationSortBy.SCORE_DESC,
  ): Prisma.JobEvaluationOrderByWithRelationInput[] {
    switch (sortBy) {
      case EvaluationSortBy.SCORE_ASC:
        return [{ score: 'asc' }, { createdAt: 'desc' }];
      case EvaluationSortBy.NEWEST:
        return [{ createdAt: 'desc' }];
      case EvaluationSortBy.OLDEST:
        return [{ createdAt: 'asc' }];
      case EvaluationSortBy.SCORE_DESC:
      default:
        // Matches the (user_id, score DESC) index backing the dashboard.
        return [{ score: 'desc' }, { createdAt: 'desc' }];
    }
  }

  /**
   * Embargoed listings stay embargoed here too. Without this check, evaluating a
   * job would work as an oracle: the summary and rubric notes describe content
   * the caller's plan is not entitled to read yet.
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
        message: 'This listing is in early access. Upgrade your plan to evaluate it now.',
        error: 'PLAN_UPGRADE_REQUIRED',
        feature: PlanFeature.EARLY_JOB_ACCESS,
      });
    }
  }

  /**
   * The candidate half of the rubric. An empty profile is allowed — the prompt
   * treats missing data as neutral — but the grade is only as good as what the
   * user has filled in, which the UI says explicitly.
   */
  private async loadProfileContext(userId: string): Promise<CandidateProfileContext> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        headline: true,
        bio: true,
        skills: true,
        yearsOfExperience: true,
        salaryExpectation: true,
        preferredLocations: true,
        preferredJobTypes: true,
      },
    });

    return {
      headline: profile?.headline ?? null,
      bio: profile?.bio ?? null,
      skills: profile?.skills ?? [],
      yearsOfExperience: profile?.yearsOfExperience ?? null,
      salaryExpectation: profile?.salaryExpectation ?? null,
      preferredLocations: profile?.preferredLocations ?? [],
      preferredJobTypes: profile?.preferredJobTypes ?? [],
    };
  }
}
