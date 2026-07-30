import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaginatedResponse, SavedJob } from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../../common/pagination/pagination.util';
import { jobListSelect, toJobListItem } from '../jobs/jobs.mapper';

@Injectable()
export class SavedJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  async list(
    userId: string,
    params: { page?: number; pageSize?: number },
  ): Promise<PaginatedResponse<SavedJob>> {
    const { page, pageSize } = normalizePagination(params.page, params.pageSize);

    const [rows, totalItems] = await Promise.all([
      this.prisma.savedJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { job: { select: jobListSelect } },
      }),
      this.prisma.savedJob.count({ where: { userId } }),
    ]);

    const items: SavedJob[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      jobId: row.jobId,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      // Saved lists always show the bookmark state as saved.
      job: { ...toJobListItem(row.job), isSaved: true },
    }));

    return buildPaginatedResponse(items, totalItems, page, pageSize);
  }

  /** Bookmarks a job, enforcing the plan's saved-job cap. */
  async save(userId: string, jobId: string, notes?: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const currentCount = await this.prisma.savedJob.count({ where: { userId } });
    await this.billing.assertWithinLimit(userId, 'maxSavedJobs', currentCount);

    try {
      const [saved] = await this.prisma.$transaction([
        this.prisma.savedJob.create({ data: { userId, jobId, notes } }),
        this.prisma.job.update({ where: { id: jobId }, data: { saveCount: { increment: 1 } } }),
      ]);
      return saved;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Job is already saved');
      }
      throw error;
    }
  }

  async updateNotes(userId: string, jobId: string, notes: string | null) {
    await this.getOrFail(userId, jobId);
    return this.prisma.savedJob.update({
      where: { userId_jobId: { userId, jobId } },
      data: { notes },
    });
  }

  async remove(userId: string, jobId: string) {
    await this.getOrFail(userId, jobId);
    await this.prisma.$transaction([
      this.prisma.savedJob.delete({ where: { userId_jobId: { userId, jobId } } }),
      this.prisma.job.update({
        where: { id: jobId },
        data: { saveCount: { decrement: 1 } },
      }),
    ]);
    return { message: 'Job removed from saved list' };
  }

  /** Ids only — used by list endpoints to hydrate `isSaved` flags cheaply. */
  async listSavedIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.savedJob.findMany({
      where: { userId },
      select: { jobId: true },
    });
    return rows.map((row) => row.jobId);
  }

  private async getOrFail(userId: string, jobId: string) {
    const saved = await this.prisma.savedJob.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });
    if (!saved) {
      throw new NotFoundException('Saved job not found');
    }
    return saved;
  }
}
