import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES, ScraperTrigger } from '@ai-career/shared';
import { ScraperService } from '../services/scraper.service';
import type { ScrapeSourceJobData } from '../../queue/queue.types';

/**
 * Consumer for the `scraper` queue. Runs in the worker process only.
 *
 * Concurrency is intentionally low (default 2): the bottleneck is third-party
 * rate limits, not CPU, and each run already ingests hundreds of postings.
 */
@Processor(QUEUE_NAMES.SCRAPER, { concurrency: Number(process.env.SCRAPER_CONCURRENCY ?? 2) })
export class ScraperProcessor extends WorkerHost {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ScrapeSourceJobData>): Promise<unknown> {
    switch (job.name) {
      case JOB_NAMES.SCRAPE_SOURCE:
        return this.handleScrapeSource(job);
      default:
        this.logger.warn(`Unknown job "${job.name}" on ${QUEUE_NAMES.SCRAPER} queue`);
        return null;
    }
  }

  private async handleScrapeSource(job: Job<ScrapeSourceJobData>) {
    const { sourceId, sourceSlug, trigger, fullSync } = job.data;
    this.logger.log(`Scraping ${sourceSlug} (trigger=${trigger}, attempt=${job.attemptsMade + 1})`);

    return this.scraperService.runSource(sourceId, {
      trigger: trigger ?? ScraperTrigger.CRON,
      queueJobId: job.id ?? null,
      attempt: job.attemptsMade + 1,
      fullSync:
        fullSync ?? this.config.get<string>('SCRAPER_DEFAULT_FULL_SYNC', 'false') === 'true',
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ScrapeSourceJobData> | undefined, error: Error): void {
    this.logger.error(
      `Scrape job ${job?.id ?? 'unknown'} (${job?.data?.sourceSlug ?? 'n/a'}) failed: ${error.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ScrapeSourceJobData>): void {
    this.logger.log(`Scrape job ${job.id} (${job.data.sourceSlug}) completed`);
  }
}
