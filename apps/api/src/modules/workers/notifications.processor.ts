import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { AlertFrequency, JOB_NAMES, QUEUE_NAMES } from '@ai-career/shared';
import { JobMatchingService } from '../notifications/job-matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  MatchNewJobsJobData,
  SendAlertDigestJobData,
  SendNotificationJobData,
} from '../queue/queue.types';

type NotificationJobData = MatchNewJobsJobData & SendAlertDigestJobData & SendNotificationJobData;

/**
 * Consumer for the `notifications` queue: alert matching, digests, and email
 * delivery. Kept separate from the scraper queue so a slow mail provider cannot
 * stall ingestion (and vice versa).
 */
@Processor(QUEUE_NAMES.NOTIFICATIONS, {
  concurrency: Number(process.env.NOTIFICATIONS_CONCURRENCY ?? 5),
})
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly matching: JobMatchingService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<Partial<NotificationJobData>>): Promise<unknown> {
    switch (true) {
      case job.name === JOB_NAMES.MATCH_NEW_JOBS:
        return this.matching.matchNewJobs(job.data.jobIds ?? [], job.data.runId);

      // The weekly digest is registered as `send-alert-digest-weekly`, so match by prefix.
      case job.name.startsWith(JOB_NAMES.SEND_ALERT_DIGEST):
        return this.matching.sendDigests(
          (job.data.frequency as AlertFrequency) ?? AlertFrequency.DAILY,
        );

      case job.name === JOB_NAMES.SEND_NOTIFICATION:
        if (!job.data.notificationId) {
          return null;
        }
        return this.notifications.deliver(job.data.notificationId);

      default:
        this.logger.warn(`Unknown job "${job.name}" on ${QUEUE_NAMES.NOTIFICATIONS} queue`);
        return null;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Notification job ${job?.id ?? 'unknown'} failed: ${error.message}`);
  }
}
