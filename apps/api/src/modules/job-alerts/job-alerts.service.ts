import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertFrequency, PlanFeature } from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { JobMatchingService } from '../notifications/job-matching.service';
import type { CreateJobAlertDto, UpdateJobAlertDto } from './dto/job-alert.dto';

@Injectable()
export class JobAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly matching: JobMatchingService,
  ) {}

  list(userId: string) {
    return this.prisma.jobAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async get(userId: string, id: string) {
    const alert = await this.prisma.jobAlert.findFirst({ where: { id, userId } });
    if (!alert) {
      throw new NotFoundException('Job alert not found');
    }
    return alert;
  }

  async create(userId: string, dto: CreateJobAlertDto) {
    const currentCount = await this.prisma.jobAlert.count({ where: { userId } });
    await this.billing.assertWithinLimit(userId, 'maxJobAlerts', currentCount);
    await this.assertFrequencyAllowed(userId, dto.frequency);
    this.assertHasCriteria(dto);

    return this.prisma.jobAlert.create({
      data: {
        userId,
        name: dto.name,
        keywords: dto.keywords ?? [],
        locations: dto.locations ?? [],
        jobTypes: dto.jobTypes ?? [],
        workModels: dto.workModels ?? [],
        experienceLevels: dto.experienceLevels ?? [],
        skills: dto.skills ?? [],
        salaryMin: dto.salaryMin ?? null,
        isRemoteOnly: dto.isRemoteOnly ?? false,
        frequency: dto.frequency ?? AlertFrequency.DAILY,
        channels: dto.channels ?? undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateJobAlertDto) {
    const existing = await this.get(userId, id);
    await this.assertFrequencyAllowed(userId, dto.frequency);

    const merged = { ...existing, ...dto };
    this.assertHasCriteria({
      keywords: merged.keywords ?? [],
      locations: merged.locations ?? [],
      skills: merged.skills ?? [],
      jobTypes: merged.jobTypes ?? [],
      experienceLevels: merged.experienceLevels ?? [],
      isRemoteOnly: merged.isRemoteOnly ?? false,
      salaryMin: merged.salaryMin ?? undefined,
    });

    return this.prisma.jobAlert.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.keywords !== undefined ? { keywords: dto.keywords } : {}),
        ...(dto.locations !== undefined ? { locations: dto.locations } : {}),
        ...(dto.jobTypes !== undefined ? { jobTypes: dto.jobTypes } : {}),
        ...(dto.workModels !== undefined ? { workModels: dto.workModels } : {}),
        ...(dto.experienceLevels !== undefined ? { experienceLevels: dto.experienceLevels } : {}),
        ...(dto.skills !== undefined ? { skills: dto.skills } : {}),
        ...(dto.salaryMin !== undefined ? { salaryMin: dto.salaryMin } : {}),
        ...(dto.isRemoteOnly !== undefined ? { isRemoteOnly: dto.isRemoteOnly } : {}),
        ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
        ...(dto.channels !== undefined ? { channels: dto.channels } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.jobAlert.delete({ where: { id } });
    return { message: 'Job alert deleted' };
  }

  /** Shows what the alert currently matches, so users can tune it before saving. */
  async preview(userId: string, id: string) {
    const alert = await this.get(userId, id);
    return this.matching.previewAlert(alert as never);
  }

  /** Instant alerts are a Premium capability; other frequencies are unrestricted. */
  private async assertFrequencyAllowed(userId: string, frequency?: AlertFrequency): Promise<void> {
    if (frequency !== AlertFrequency.INSTANT) {
      return;
    }
    if (!(await this.billing.hasFeature(userId, PlanFeature.INSTANT_ALERTS))) {
      throw new ForbiddenException({
        message: 'Instant alerts require the Premium plan. Choose daily or weekly instead.',
        error: 'PLAN_UPGRADE_REQUIRED',
        feature: PlanFeature.INSTANT_ALERTS,
      });
    }
  }

  /**
   * An alert with no criteria would match the entire feed and spam the user, so
   * at least one filter is required.
   */
  private assertHasCriteria(dto: {
    keywords?: string[];
    locations?: string[];
    skills?: string[];
    jobTypes?: unknown[];
    experienceLevels?: unknown[];
    isRemoteOnly?: boolean;
    salaryMin?: number;
  }): void {
    const hasCriteria =
      (dto.keywords?.length ?? 0) > 0 ||
      (dto.locations?.length ?? 0) > 0 ||
      (dto.skills?.length ?? 0) > 0 ||
      (dto.jobTypes?.length ?? 0) > 0 ||
      (dto.experienceLevels?.length ?? 0) > 0 ||
      dto.isRemoteOnly === true ||
      (dto.salaryMin ?? 0) > 0;

    if (!hasCriteria) {
      throw new ForbiddenException(
        'Add at least one filter (keyword, location, skill, job type, remote, or salary) to the alert',
      );
    }
  }
}
