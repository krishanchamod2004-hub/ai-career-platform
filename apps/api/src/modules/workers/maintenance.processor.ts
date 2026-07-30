import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '@ai-career/shared';
import { ScraperService } from '../scraper/services/scraper.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ApplicationsService } from '../applications/applications.service';
import type { MaintenanceJobData } from '../queue/queue.types';

/**
 * Consumer for the `maintenance` queue: stale-job expiry, daily metric rollups,
 * application follow-up reminders, and log retention.
 */
@Processor(QUEUE_NAMES.MAINTENANCE, { concurrency: 1 })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly scraper: ScraperService,
    private readonly analytics: AnalyticsService,
    private readonly applications: ApplicationsService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<MaintenanceJobData>): Promise<unknown> {
    const asOf = job.data?.asOf ? new Date(job.data.asOf) : new Date();

    switch (job.name) {
      case JOB_NAMES.EXPIRE_STALE_JOBS: {
        const staleDays = Number(this.config.get('JOB_STALE_DAYS', 14));
        const [expiredStale, expiredDeadline] = await Promise.all([
          this.scraper.expireStaleJobs(staleDays),
          this.scraper.expirePastDeadlineJobs(),
        ]);
        return { expiredStale, expiredDeadline };
      }

      case JOB_NAMES.COMPUTE_DAILY_STATS:
        // Roll up the day that just ended, not the partial current day.
        return this.analytics.computeDailyStats(new Date(asOf.getTime() - 60 * 60 * 1000));

      case JOB_NAMES.APPLICATION_REMINDERS:
        return this.applications.processDueReminders();

      case JOB_NAMES.PRUNE_LOGS:
        return this.analytics.pruneLogs(Number(this.config.get('LOG_RETENTION_DAYS', 30)));

      default:
        this.logger.warn(`Unknown job "${job.name}" on ${QUEUE_NAMES.MAINTENANCE} queue`);
        return null;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Maintenance job ${job?.name ?? 'unknown'} failed: ${error.message}`);
  }
}
