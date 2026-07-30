import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  JobStatus,
  NotificationStatus,
  ScraperRunStatus,
  type AnalyticsOverview,
  type DailyStatPoint,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Platform analytics.
 *
 * `getOverview` runs live counts (cheap: every predicate is index-backed) for the
 * admin dashboard, while `computeDailyStats` snapshots the same figures nightly
 * into DailyStat so trend charts never scan the jobs table.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AnalyticsOverview> {
    const startOfToday = startOfUtcDay(new Date());
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [
      totalJobs,
      activeJobs,
      newJobsToday,
      newJobs7Days,
      totalCompanies,
      totalUsers,
      activeUsers7Days,
      activeUsers30Days,
      totalSavedJobs,
      totalApplications,
      applicationsToday,
      totalAlerts,
      jobsBySource,
    ] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: JobStatus.ACTIVE } }),
      this.prisma.job.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.job.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.company.count(),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: thirtyDaysAgo } } }),
      this.prisma.savedJob.count(),
      this.prisma.application.count(),
      this.prisma.application.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.jobAlert.count(),
      this.prisma.job.groupBy({ by: ['sourceId'], _count: { _all: true } }),
    ]);

    const sources = await this.prisma.jobSource.findMany({ select: { id: true, name: true } });
    const sourceNames = new Map(sources.map((source) => [source.id, source.name]));

    return {
      totalJobs,
      activeJobs,
      newJobsToday,
      newJobs7Days,
      totalCompanies,
      totalUsers,
      activeUsers7Days,
      activeUsers30Days,
      totalSavedJobs,
      totalApplications,
      applicationsToday,
      totalAlerts,
      jobsBySource: jobsBySource
        .map((entry) => ({
          source: entry.sourceId ? (sourceNames.get(entry.sourceId) ?? 'Unknown') : 'Manual',
          count: entry._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /** Time series for admin charts, newest last. */
  async getDailySeries(days = 30): Promise<DailyStatPoint[]> {
    const since = startOfUtcDay(new Date(Date.now() - days * 24 * 3600 * 1000));
    const rows = await this.prisma.dailyStat.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      newJobs: row.newJobs,
      activeUsers: row.activeUsers,
      savedJobs: row.savedJobs,
      applications: row.applications,
      scraperRuns: row.scraperRuns,
      scraperFailures: row.scraperFailures,
    }));
  }

  /**
   * Maintenance-worker entrypoint. Idempotent per day (upsert on the date key), so
   * re-running a missed rollup is safe.
   */
  async computeDailyStats(asOf = new Date()): Promise<DailyStatPoint> {
    const dayStart = startOfUtcDay(asOf);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const window = { gte: dayStart, lt: dayEnd };

    const [
      totalJobs,
      activeJobs,
      newJobs,
      totalCompanies,
      newUsers,
      activeUsers,
      savedJobs,
      applications,
      scraperRuns,
      scraperFailures,
      notificationsSent,
    ] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: JobStatus.ACTIVE } }),
      this.prisma.job.count({ where: { createdAt: window } }),
      this.prisma.company.count(),
      this.prisma.user.count({ where: { createdAt: window } }),
      this.prisma.user.count({ where: { lastActiveAt: window } }),
      this.prisma.savedJob.count({ where: { createdAt: window } }),
      this.prisma.application.count({ where: { createdAt: window } }),
      this.prisma.scraperRun.count({ where: { startedAt: window } }),
      this.prisma.scraperRun.count({
        where: { startedAt: window, status: ScraperRunStatus.FAILED },
      }),
      this.prisma.notification.count({
        where: { sentAt: window, status: NotificationStatus.SENT },
      }),
    ]);

    const data = {
      totalJobs,
      activeJobs,
      newJobs,
      totalCompanies,
      newUsers,
      activeUsers,
      savedJobs,
      applications,
      scraperRuns,
      scraperFailures,
      notificationsSent,
    };

    await this.prisma.dailyStat.upsert({
      where: { date: dayStart },
      update: data,
      create: { date: dayStart, ...data },
    });

    return {
      date: dayStart.toISOString().slice(0, 10),
      newJobs,
      activeUsers,
      savedJobs,
      applications,
      scraperRuns,
      scraperFailures,
    };
  }

  /** Per-user summary shown on the member dashboard. */
  async getUserSummary(userId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [savedJobs, applications, activeAlerts, interviews, newMatches] = await Promise.all([
      this.prisma.savedJob.count({ where: { userId } }),
      this.prisma.application.count({ where: { userId } }),
      this.prisma.jobAlert.count({ where: { userId, isActive: true } }),
      this.prisma.application.count({
        where: { userId, status: ApplicationStatus.INTERVIEW },
      }),
      this.prisma.notification.count({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
      }),
    ]);

    return { savedJobs, applications, activeAlerts, interviews, newMatchesLast7Days: newMatches };
  }

  /** Retention: drops scraper/system logs older than the retention window. */
  async pruneLogs(retentionDays = 30): Promise<{ scraperLogs: number; systemLogs: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);
    const [scraperLogs, systemLogs] = await Promise.all([
      this.prisma.scraperLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      this.prisma.systemLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ]);
    return { scraperLogs: scraperLogs.count, systemLogs: systemLogs.count };
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
