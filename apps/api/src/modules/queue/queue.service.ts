import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES, ScraperTrigger, type QueueStats } from '@ai-career/shared';
import type {
  MaintenanceJobData,
  MatchNewJobsJobData,
  ScrapeSourceJobData,
  SendAlertDigestJobData,
  SendNotificationJobData,
} from './queue.types';

/**
 * Typed producer facade over the BullMQ queues. Every enqueue in the codebase
 * goes through here so job names, dedupe ids, and retry policy stay consistent.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.SCRAPER) private readonly scraperQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MAINTENANCE) private readonly maintenanceQueue: Queue,
  ) {}

  // --- scraper -------------------------------------------------------------

  async enqueueScrapeSource(data: ScrapeSourceJobData, options: JobsOptions = {}) {
    // Manual triggers jump the queue ahead of scheduled cron runs.
    const priority = data.trigger === ScraperTrigger.MANUAL ? 1 : 5;
    return this.scraperQueue.add(JOB_NAMES.SCRAPE_SOURCE, data, { priority, ...options });
  }

  /**
   * Registers (or refreshes) the repeatable cron entry for a source.
   * Uses a deterministic job id so re-registering on every boot cannot create duplicates.
   */
  async upsertSourceSchedule(data: ScrapeSourceJobData, cronExpression: string): Promise<void> {
    const repeatJobKey = `source:${data.sourceSlug}`;
    await this.removeSourceSchedule(data.sourceSlug);
    await this.scraperQueue.add(JOB_NAMES.SCRAPE_SOURCE, data, {
      repeat: { pattern: cronExpression, key: repeatJobKey },
      jobId: repeatJobKey,
    });
    this.logger.log(`Scheduled source ${data.sourceSlug} with cron "${cronExpression}"`);
  }

  async removeSourceSchedule(sourceSlug: string): Promise<void> {
    const repeatJobKey = `source:${sourceSlug}`;
    const repeatables = await this.scraperQueue.getRepeatableJobs();
    for (const repeatable of repeatables) {
      if (repeatable.key.includes(repeatJobKey) || repeatable.id === repeatJobKey) {
        await this.scraperQueue.removeRepeatableByKey(repeatable.key);
      }
    }
  }

  // --- notifications -------------------------------------------------------

  async enqueueJobMatching(data: MatchNewJobsJobData) {
    if (data.jobIds.length === 0) {
      return null;
    }
    return this.notificationsQueue.add(JOB_NAMES.MATCH_NEW_JOBS, data);
  }

  async enqueueAlertDigest(data: SendAlertDigestJobData) {
    return this.notificationsQueue.add(JOB_NAMES.SEND_ALERT_DIGEST, data);
  }

  async enqueueNotificationDelivery(data: SendNotificationJobData) {
    return this.notificationsQueue.add(JOB_NAMES.SEND_NOTIFICATION, data, {
      // Idempotent: the same notification can never be delivered twice.
      jobId: `notification:${data.notificationId}`,
    });
  }

  async upsertRepeatable(
    queueName: keyof typeof QUEUE_NAMES,
    jobName: string,
    cronExpression: string,
    data: MaintenanceJobData | SendAlertDigestJobData = {},
  ): Promise<void> {
    const queue = this.resolveQueue(QUEUE_NAMES[queueName]);
    const key = `cron:${jobName}`;
    const repeatables = await queue.getRepeatableJobs();
    for (const repeatable of repeatables) {
      if (repeatable.name === jobName) {
        await queue.removeRepeatableByKey(repeatable.key);
      }
    }
    await queue.add(jobName, data, { repeat: { pattern: cronExpression, key }, jobId: key });
    this.logger.log(`Scheduled ${jobName} on ${queueName} with cron "${cronExpression}"`);
  }

  // --- observability -------------------------------------------------------

  async getStats(): Promise<QueueStats[]> {
    const queues = [this.scraperQueue, this.notificationsQueue, this.maintenanceQueue];
    return Promise.all(
      queues.map(async (queue) => {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        );
        return {
          name: queue.name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          isPaused: await queue.isPaused(),
        };
      }),
    );
  }

  private resolveQueue(name: string): Queue {
    switch (name) {
      case QUEUE_NAMES.SCRAPER:
        return this.scraperQueue;
      case QUEUE_NAMES.NOTIFICATIONS:
        return this.notificationsQueue;
      default:
        return this.maintenanceQueue;
    }
  }
}
