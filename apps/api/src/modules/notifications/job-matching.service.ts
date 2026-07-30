import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  AlertFrequency,
  JobStatus,
  NotificationChannel,
  NotificationType,
  PlanFeature,
  type JobAlert,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from './notifications.service';

type AlertRow = Prisma.JobAlertGetPayload<{ include: { user: { select: { id: true } } } }>;

const MAX_JOBS_PER_NOTIFICATION = 10;

/**
 * Final stage of the ingestion workflow: turn newly stored jobs into user-facing
 * notifications.
 *
 * INSTANT alerts fire from the scraper's `match-new-jobs` handoff; DAILY/WEEKLY
 * alerts are batched by the digest cron so users get one email instead of dozens.
 */
@Injectable()
export class JobMatchingService {
  private readonly logger = new Logger(JobMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly billing: BillingService,
  ) {}

  /** Called with the ids created by a scrape run. */
  async matchNewJobs(jobIds: string[], runId?: string): Promise<{ notified: number }> {
    if (jobIds.length === 0) {
      return { notified: 0 };
    }

    const alerts = await this.prisma.jobAlert.findMany({
      where: { isActive: true, frequency: AlertFrequency.INSTANT },
      include: { user: { select: { id: true } } },
    });

    if (alerts.length === 0) {
      return { notified: 0 };
    }

    let notified = 0;

    for (const alert of alerts) {
      // Instant delivery is a Premium capability; a downgraded user's alert
      // silently falls back to the digest path instead of erroring.
      if (!(await this.billing.hasFeature(alert.userId, PlanFeature.INSTANT_ALERTS))) {
        continue;
      }

      const matches = await this.prisma.job.findMany({
        where: { AND: [{ id: { in: jobIds } }, this.buildAlertWhere(alert)] },
        select: { id: true, title: true, slug: true, company: { select: { name: true } } },
        take: MAX_JOBS_PER_NOTIFICATION,
      });

      if (matches.length === 0) {
        continue;
      }

      await this.emitAlertNotification(alert, matches, {
        type: NotificationType.NEW_MATCHING_JOBS,
        dedupeKey: `alert:${alert.id}:run:${runId ?? 'adhoc'}`,
      });
      notified += 1;
    }

    this.logger.log(`Matched ${jobIds.length} new jobs against ${alerts.length} instant alerts`);
    return { notified };
  }

  /** Cron entrypoint for DAILY / WEEKLY digests. */
  async sendDigests(frequency: AlertFrequency): Promise<{ sent: number }> {
    const alerts = await this.prisma.jobAlert.findMany({
      where: { isActive: true, frequency },
      include: { user: { select: { id: true } } },
    });

    const fallbackWindowMs =
      frequency === AlertFrequency.WEEKLY ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
    let sent = 0;

    for (const alert of alerts) {
      const since = alert.lastSentAt ?? new Date(Date.now() - fallbackWindowMs);

      const matches = await this.prisma.job.findMany({
        where: { AND: [{ createdAt: { gte: since } }, this.buildAlertWhere(alert)] },
        orderBy: { postedAt: 'desc' },
        select: { id: true, title: true, slug: true, company: { select: { name: true } } },
        take: MAX_JOBS_PER_NOTIFICATION,
      });

      if (matches.length === 0) {
        continue;
      }

      await this.emitAlertNotification(alert, matches, {
        type: NotificationType.JOB_ALERT_DIGEST,
        // One digest per alert per day (or ISO week) regardless of retries.
        dedupeKey: `alert:${alert.id}:${frequency}:${digestPeriodKey(frequency)}`,
      });
      sent += 1;
    }

    this.logger.log(`Sent ${sent} ${frequency} alert digest(s)`);
    return { sent };
  }

  /** Preview endpoint: what would this alert have matched recently? */
  async previewAlert(alert: JobAlert | AlertRow, limit = 10) {
    return this.prisma.job.findMany({
      where: this.buildAlertWhere(alert),
      orderBy: { postedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        location: true,
        isRemote: true,
        postedAt: true,
        company: { select: { name: true, logoUrl: true } },
      },
    });
  }

  private async emitAlertNotification(
    alert: AlertRow,
    matches: Array<{ id: string; title: string; slug: string; company: { name: string } | null }>,
    options: { type: NotificationType; dedupeKey: string },
  ): Promise<void> {
    const lines = matches.map(
      (job) => `• ${job.title}${job.company ? ` at ${job.company.name}` : ''}`,
    );
    const title =
      matches.length === 1
        ? `New job matching "${alert.name}"`
        : `${matches.length} new jobs matching "${alert.name}"`;

    await this.notifications.create({
      userId: alert.userId,
      type: options.type,
      title,
      body: `${lines.join('\n')}\n\nOpen your job feed to review and apply.`,
      data: {
        alertId: alert.id,
        jobIds: matches.map((job) => job.id),
        url: `/jobs?alertId=${alert.id}`,
      },
      channels: (alert.channels as NotificationChannel[]) ?? [NotificationChannel.IN_APP],
      dedupeKey: options.dedupeKey,
    });

    await this.prisma.jobAlert.update({
      where: { id: alert.id },
      data: {
        lastSentAt: new Date(),
        lastMatchedJobAt: new Date(),
        matchCount: { increment: matches.length },
      },
    });
  }

  /**
   * Translates a stored alert into a Prisma filter.
   * Empty criteria arrays are ignored (an alert with no keywords matches on its
   * other criteria rather than matching nothing).
   */
  buildAlertWhere(alert: {
    keywords: string[];
    locations: string[];
    jobTypes: string[];
    workModels: string[];
    experienceLevels: string[];
    skills: string[];
    salaryMin: number | null;
    isRemoteOnly: boolean;
  }): Prisma.JobWhereInput {
    const and: Prisma.JobWhereInput[] = [{ status: JobStatus.ACTIVE }];

    if (alert.keywords.length > 0) {
      and.push({
        OR: alert.keywords.flatMap((keyword) => [
          { title: { contains: keyword, mode: 'insensitive' as const } },
          { description: { contains: keyword, mode: 'insensitive' as const } },
        ]),
      });
    }
    if (alert.locations.length > 0) {
      and.push({
        OR: alert.locations.flatMap((location) => [
          { location: { contains: location, mode: 'insensitive' as const } },
          { city: { contains: location, mode: 'insensitive' as const } },
          { country: { contains: location, mode: 'insensitive' as const } },
        ]),
      });
    }
    if (alert.jobTypes.length > 0) {
      and.push({ jobType: { in: alert.jobTypes as never } });
    }
    if (alert.workModels.length > 0) {
      and.push({ workModel: { in: alert.workModels as never } });
    }
    if (alert.experienceLevels.length > 0) {
      and.push({ experienceLevel: { in: alert.experienceLevels as never } });
    }
    if (alert.skills.length > 0) {
      and.push({ skills: { hasSome: alert.skills } });
    }
    if (alert.isRemoteOnly) {
      and.push({ isRemote: true });
    }
    if (alert.salaryMin) {
      and.push({
        OR: [{ salaryMax: { gte: alert.salaryMin } }, { salaryMin: { gte: alert.salaryMin } }],
      });
    }

    return { AND: and };
  }
}

/** Stable period key so retries within the same day/week dedupe correctly. */
function digestPeriodKey(frequency: AlertFrequency): string {
  const now = new Date();
  if (frequency === AlertFrequency.WEEKLY) {
    const firstDayOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((now.getTime() - firstDayOfYear.getTime()) / 86_400_000);
    return `${now.getUTCFullYear()}-W${Math.ceil((dayOfYear + firstDayOfYear.getUTCDay() + 1) / 7)}`;
  }
  return now.toISOString().slice(0, 10);
}
