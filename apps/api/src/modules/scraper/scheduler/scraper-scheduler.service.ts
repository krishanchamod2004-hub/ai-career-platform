import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JOB_NAMES } from '@ai-career/shared';
import { QueueService } from '../../queue/queue.service';
import { JobSourcesService } from '../services/job-sources.service';

/**
 * Registers every recurring job on boot.
 *
 * Cron lives in BullMQ (repeatable jobs) rather than in-process timers so that
 * running N worker replicas does not run N copies of each schedule — Redis holds
 * the single schedule and exactly one worker picks up each occurrence.
 *
 * Only processes with ENABLE_SCHEDULER=true register schedules (the worker
 * container); the API container stays a pure producer.
 */
@Injectable()
export class ScraperSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScraperSchedulerService.name);

  constructor(
    private readonly queue: QueueService,
    private readonly sources: JobSourcesService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('ENABLE_SCHEDULER', 'false') !== 'true') {
      this.logger.log('Scheduler disabled for this process (ENABLE_SCHEDULER != true)');
      return;
    }

    try {
      const count = await this.sources.syncAllSchedules();
      this.logger.log(`Registered cron schedules for ${count} enabled job source(s)`);
      await this.registerPlatformSchedules();
    } catch (error) {
      // A scheduling failure must not prevent the worker from processing jobs.
      this.logger.error(`Failed to register schedules: ${(error as Error).message}`);
    }
  }

  /** Platform-wide recurring work that is not tied to a specific source. */
  private async registerPlatformSchedules(): Promise<void> {
    await this.queue.upsertRepeatable(
      'NOTIFICATIONS',
      JOB_NAMES.SEND_ALERT_DIGEST,
      this.config.get<string>('CRON_DAILY_DIGEST', '0 8 * * *'),
      { frequency: 'DAILY' },
    );

    await this.queue.upsertRepeatable(
      'NOTIFICATIONS',
      `${JOB_NAMES.SEND_ALERT_DIGEST}-weekly`,
      this.config.get<string>('CRON_WEEKLY_DIGEST', '0 8 * * 1'),
      { frequency: 'WEEKLY' },
    );

    await this.queue.upsertRepeatable(
      'MAINTENANCE',
      JOB_NAMES.EXPIRE_STALE_JOBS,
      this.config.get<string>('CRON_EXPIRE_JOBS', '30 3 * * *'),
    );

    await this.queue.upsertRepeatable(
      'MAINTENANCE',
      JOB_NAMES.COMPUTE_DAILY_STATS,
      this.config.get<string>('CRON_DAILY_STATS', '15 0 * * *'),
    );

    await this.queue.upsertRepeatable(
      'MAINTENANCE',
      JOB_NAMES.APPLICATION_REMINDERS,
      this.config.get<string>('CRON_APPLICATION_REMINDERS', '0 9 * * *'),
    );

    await this.queue.upsertRepeatable(
      'MAINTENANCE',
      JOB_NAMES.PRUNE_LOGS,
      this.config.get<string>('CRON_PRUNE_LOGS', '0 4 * * 0'),
    );
  }
}
