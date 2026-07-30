import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ApplicationStatus,
  NotificationChannel,
  NotificationType,
  type Application,
  type ApplicationBoard,
  type ApplicationStats,
  type PaginatedResponse,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../../common/pagination/pagination.util';
import { jobListSelect, toJobListItem } from '../jobs/jobs.mapper';
import type {
  CreateApplicationDto,
  UpdateApplicationDto,
  UpdateApplicationStatusDto,
} from './dto/application.dto';

const applicationInclude = {
  job: { select: jobListSelect },
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ApplicationInclude;

type ApplicationRow = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    userId: string,
    params: { page?: number; pageSize?: number; status?: ApplicationStatus },
  ): Promise<PaginatedResponse<Application>> {
    const { page, pageSize } = normalizePagination(params.page, params.pageSize);
    const where: Prisma.ApplicationWhereInput = {
      userId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: applicationInclude,
      }),
      this.prisma.application.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => this.toApplication(row)),
      totalItems,
      page,
      pageSize,
    );
  }

  /** Kanban view: applications grouped by status, ordered by their board position. */
  async board(userId: string): Promise<ApplicationBoard> {
    const rows = await this.prisma.application.findMany({
      where: { userId },
      orderBy: [{ boardOrder: 'asc' }, { updatedAt: 'desc' }],
      include: applicationInclude,
    });

    const board = Object.values(ApplicationStatus).reduce((accumulator, status) => {
      accumulator[status] = [];
      return accumulator;
    }, {} as ApplicationBoard);

    for (const row of rows) {
      board[row.status as ApplicationStatus].push(this.toApplication(row));
    }
    return board;
  }

  async get(userId: string, id: string): Promise<Application> {
    const row = await this.prisma.application.findFirst({
      where: { id, userId },
      include: applicationInclude,
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    return this.toApplication(row);
  }

  /**
   * Creates a tracker entry, either linked to a platform job (title/company are
   * snapshotted from it) or as a fully manual record.
   */
  async create(userId: string, dto: CreateApplicationDto): Promise<Application> {
    const currentCount = await this.prisma.application.count({ where: { userId } });
    await this.billing.assertWithinLimit(userId, 'maxApplications', currentCount);

    let snapshot = {
      jobTitle: dto.jobTitle?.trim() ?? '',
      companyName: dto.companyName?.trim() ?? '',
      jobUrl: dto.jobUrl ?? null,
      location: dto.location ?? null,
    };

    if (dto.jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: dto.jobId },
        select: {
          id: true,
          title: true,
          applyUrl: true,
          externalUrl: true,
          location: true,
          company: { select: { name: true } },
        },
      });
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      snapshot = {
        jobTitle: snapshot.jobTitle || job.title,
        companyName: snapshot.companyName || job.company?.name || 'Unknown company',
        jobUrl: snapshot.jobUrl ?? job.applyUrl ?? job.externalUrl,
        location: snapshot.location ?? job.location,
      };
    }

    if (!snapshot.jobTitle || !snapshot.companyName) {
      throw new BadRequestException('jobTitle and companyName are required for manual applications');
    }

    const status = dto.status ?? ApplicationStatus.SAVED;
    const appliedAt =
      dto.appliedAt ?? (status !== ApplicationStatus.SAVED ? new Date().toISOString() : undefined);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const application = await tx.application.create({
          data: {
            userId,
            jobId: dto.jobId ?? null,
            status,
            jobTitle: snapshot.jobTitle,
            companyName: snapshot.companyName,
            jobUrl: snapshot.jobUrl,
            location: snapshot.location,
            salaryNote: dto.salaryNote ?? null,
            resumeUrl: dto.resumeUrl ?? null,
            coverLetter: dto.coverLetter ?? null,
            notes: dto.notes ?? null,
            appliedAt: appliedAt ? new Date(appliedAt) : null,
            nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
            nextActionNote: dto.nextActionNote ?? null,
            events: { create: { toStatus: status, note: 'Application created' } },
          },
          include: applicationInclude,
        });

        if (dto.jobId) {
          await tx.job.update({
            where: { id: dto.jobId },
            data: { applicationCount: { increment: 1 } },
          });
        }
        return application;
      });

      return this.toApplication(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You already track an application for this job');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateApplicationDto): Promise<Application> {
    await this.get(userId, id);

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.jobUrl !== undefined ? { jobUrl: dto.jobUrl } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.salaryNote !== undefined ? { salaryNote: dto.salaryNote } : {}),
        ...(dto.resumeUrl !== undefined ? { resumeUrl: dto.resumeUrl } : {}),
        ...(dto.coverLetter !== undefined ? { coverLetter: dto.coverLetter } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.boardOrder !== undefined ? { boardOrder: dto.boardOrder } : {}),
        ...(dto.appliedAt !== undefined ? { appliedAt: new Date(dto.appliedAt) } : {}),
        ...(dto.nextActionAt !== undefined
          ? { nextActionAt: new Date(dto.nextActionAt), reminderSentAt: null }
          : {}),
        ...(dto.nextActionNote !== undefined ? { nextActionNote: dto.nextActionNote } : {}),
      },
      include: applicationInclude,
    });

    return this.toApplication(updated);
  }

  /** Status changes always append an ApplicationEvent (the analytics funnel source). */
  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateApplicationStatusDto,
  ): Promise<Application> {
    const existing = await this.prisma.application.findFirst({
      where: { id, userId },
      select: { id: true, status: true, appliedAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Application not found');
    }

    if (existing.status === dto.status && dto.boardOrder === undefined) {
      return this.get(userId, id);
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.boardOrder !== undefined ? { boardOrder: dto.boardOrder } : {}),
        // Stamp appliedAt the first time the card leaves the SAVED column.
        ...(dto.status !== ApplicationStatus.SAVED && !existing.appliedAt
          ? { appliedAt: new Date() }
          : {}),
        ...(existing.status !== dto.status
          ? {
              events: {
                create: {
                  fromStatus: existing.status,
                  toStatus: dto.status,
                  note: dto.note ?? null,
                },
              },
            }
          : {}),
      },
      include: applicationInclude,
    });

    return this.toApplication(updated);
  }

  async remove(userId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, userId },
      select: { id: true, jobId: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.application.delete({ where: { id } });
      if (application.jobId) {
        await tx.job.update({
          where: { id: application.jobId },
          data: { applicationCount: { decrement: 1 } },
        });
      }
    });

    return { message: 'Application deleted' };
  }

  /**
   * Funnel metrics for the tracker. Interview/offer rates are computed from
   * ApplicationEvent history so they stay correct even after a card is moved on.
   */
  async stats(userId: string): Promise<ApplicationStats> {
    const now = Date.now();
    const [grouped, total, applied7, applied30, events] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.application.count({ where: { userId } }),
      this.prisma.application.count({
        where: { userId, appliedAt: { gte: new Date(now - 7 * 24 * 3600 * 1000) } },
      }),
      this.prisma.application.count({
        where: { userId, appliedAt: { gte: new Date(now - 30 * 24 * 3600 * 1000) } },
      }),
      this.prisma.applicationEvent.findMany({
        where: { application: { userId } },
        select: { applicationId: true, toStatus: true, createdAt: true },
      }),
    ]);

    const byStatus = Object.values(ApplicationStatus).reduce(
      (accumulator, status) => {
        accumulator[status] =
          grouped.find((entry) => entry.status === status)?._count._all ?? 0;
        return accumulator;
      },
      {} as Record<ApplicationStatus, number>,
    );

    const appliedIds = new Set<string>();
    const interviewedIds = new Set<string>();
    const offeredIds = new Set<string>();
    const rejectedIds = new Set<string>();
    const appliedAtByApplication = new Map<string, Date>();
    const interviewAtByApplication = new Map<string, Date>();

    for (const event of events) {
      if (event.toStatus === ApplicationStatus.APPLIED) {
        appliedIds.add(event.applicationId);
        if (!appliedAtByApplication.has(event.applicationId)) {
          appliedAtByApplication.set(event.applicationId, event.createdAt);
        }
      }
      if (event.toStatus === ApplicationStatus.INTERVIEW) {
        interviewedIds.add(event.applicationId);
        if (!interviewAtByApplication.has(event.applicationId)) {
          interviewAtByApplication.set(event.applicationId, event.createdAt);
        }
      }
      if (event.toStatus === ApplicationStatus.OFFER) offeredIds.add(event.applicationId);
      if (event.toStatus === ApplicationStatus.REJECTED) rejectedIds.add(event.applicationId);
    }

    const appliedTotal = appliedIds.size;
    const daysToInterview: number[] = [];
    for (const [applicationId, interviewAt] of interviewAtByApplication) {
      const appliedAt = appliedAtByApplication.get(applicationId);
      if (appliedAt) {
        daysToInterview.push(
          (interviewAt.getTime() - appliedAt.getTime()) / (24 * 3600 * 1000),
        );
      }
    }

    const ratio = (numerator: number, denominator: number): number =>
      denominator === 0 ? 0 : Number((numerator / denominator).toFixed(2));

    return {
      total,
      byStatus,
      interviewRate: ratio(interviewedIds.size, appliedTotal),
      offerRate: ratio(offeredIds.size, appliedTotal),
      responseRate: ratio(interviewedIds.size + offeredIds.size + rejectedIds.size, appliedTotal),
      avgDaysToInterview:
        daysToInterview.length === 0
          ? null
          : Number(
              (
                daysToInterview.reduce((sum, value) => sum + value, 0) / daysToInterview.length
              ).toFixed(1),
            ),
      appliedLast7Days: applied7,
      appliedLast30Days: applied30,
    };
  }

  /**
   * Maintenance-worker entrypoint: notifies users about follow-ups that are due.
   * `reminderSentAt` guards against repeat sends for the same due date.
   */
  async processDueReminders(): Promise<{ sent: number }> {
    const due = await this.prisma.application.findMany({
      where: {
        nextActionAt: { lte: new Date() },
        reminderSentAt: null,
        status: { notIn: [ApplicationStatus.REJECTED] },
      },
      select: {
        id: true,
        userId: true,
        jobTitle: true,
        companyName: true,
        nextActionAt: true,
        nextActionNote: true,
      },
      take: 500,
    });

    for (const application of due) {
      await this.notifications.create({
        userId: application.userId,
        type: NotificationType.APPLICATION_REMINDER,
        title: `Follow up: ${application.jobTitle} at ${application.companyName}`,
        body:
          application.nextActionNote ??
          'You scheduled a follow-up for this application. Time to check in.',
        data: { applicationId: application.id, url: '/dashboard/applications' },
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        dedupeKey: `application-reminder:${application.id}:${application.nextActionAt?.toISOString().slice(0, 10)}`,
      });

      await this.prisma.application.update({
        where: { id: application.id },
        data: { reminderSentAt: new Date() },
      });
    }

    return { sent: due.length };
  }

  private toApplication(row: ApplicationRow): Application {
    return {
      id: row.id,
      userId: row.userId,
      jobId: row.jobId,
      status: row.status as ApplicationStatus,
      jobTitle: row.jobTitle,
      companyName: row.companyName,
      jobUrl: row.jobUrl,
      location: row.location,
      salaryNote: row.salaryNote,
      resumeUrl: row.resumeUrl,
      coverLetter: row.coverLetter,
      notes: row.notes,
      appliedAt: row.appliedAt?.toISOString() ?? null,
      nextActionAt: row.nextActionAt?.toISOString() ?? null,
      nextActionNote: row.nextActionNote,
      boardOrder: row.boardOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      job: row.job ? toJobListItem(row.job) : null,
      events: row.events.map((event) => ({
        id: event.id,
        applicationId: event.applicationId,
        fromStatus: event.fromStatus as ApplicationStatus | null,
        toStatus: event.toStatus as ApplicationStatus,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}
