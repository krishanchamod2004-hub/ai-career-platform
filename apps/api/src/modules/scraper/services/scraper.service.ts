import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JobStatus,
  LogLevel,
  ScraperRunStatus,
  ScraperTrigger,
  type SourceHealth,
} from '@ai-career/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { AdapterRegistry } from '../adapters/adapter.registry';
import { JobParserService } from '../parsers/job-parser.service';
import { DataCleanerService } from './data-cleaner.service';
import { DedupeService } from './dedupe.service';
import { JobIngestionService } from './job-ingestion.service';
import { ScraperLogService } from './scraper-log.service';
import type { RunSourceOptions, ScrapeRunResult } from '../scraper.types';

/**
 * Pipeline orchestrator:
 *
 *   scheduler → [ adapter.fetch → parser → cleaner → dedupe → ingestion ] → notification queue
 *
 * Every run is recorded as a ScraperRun row (counts, duration, error) so the
 * admin dashboard and daily analytics have a durable audit trail.
 */
@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly maxConsecutiveFailures: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly parser: JobParserService,
    private readonly cleaner: DataCleanerService,
    private readonly dedupe: DedupeService,
    private readonly ingestion: JobIngestionService,
    private readonly logs: ScraperLogService,
    private readonly queue: QueueService,
    config: ConfigService,
  ) {
    this.maxConsecutiveFailures = Number(config.get('SCRAPER_MAX_CONSECUTIVE_FAILURES', 10));
  }

  async runSource(sourceId: string, options: RunSourceOptions): Promise<ScrapeRunResult> {
    const source = await this.prisma.jobSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      throw new NotFoundException(`Job source ${sourceId} not found`);
    }

    const run = await this.prisma.scraperRun.create({
      data: {
        sourceId: source.id,
        status: ScraperRunStatus.RUNNING,
        trigger: options.trigger,
        queueJobId: options.queueJobId ?? null,
        attempt: options.attempt ?? 1,
      },
    });

    const runLogger = this.logs.createRunLogger({ runId: run.id, sourceId: source.id });
    const startedAt = Date.now();

    try {
      const adapter = this.registry.get(source.type);

      // Incremental watermark: only re-read what may have changed since the last
      // successful run (with an overlap window to tolerate upstream backdating).
      const since =
        options.fullSync || !source.lastSuccessAt
          ? null
          : new Date(source.lastSuccessAt.getTime() - 6 * 3600 * 1000);

      runLogger.info(`Fetching from ${source.name} (${source.type})`, {
        since: since?.toISOString() ?? null,
        fullSync: Boolean(options.fullSync),
      });

      const rawJobs = await adapter.fetchJobs({
        config: (source.config ?? {}) as Record<string, unknown>,
        requestsPerMinute: source.requestsPerMinute,
        since,
        fullSync: options.fullSync,
        logger: runLogger,
      });

      const parsed = this.parser.parseMany(rawJobs);
      const { jobs: cleaned, rejected } = this.cleaner.clean(parsed);
      const { jobs: deduped, duplicatesInBatch } = this.dedupe.prepare(cleaned);

      if (rejected.length > 0) {
        runLogger.warn(`Cleaner rejected ${rejected.length} postings`, {
          samples: rejected.slice(0, 5),
        });
      }

      const ingestionResult = await this.ingestion.ingest(deduped, source.id);
      const durationMs = Date.now() - startedAt;
      const skipped = ingestionResult.skipped + rejected.length + duplicatesInBatch;

      const status =
        ingestionResult.failed > 0 || rejected.length > 0
          ? ScraperRunStatus.PARTIAL
          : ScraperRunStatus.SUCCESS;

      await this.prisma.$transaction([
        this.prisma.scraperRun.update({
          where: { id: run.id },
          data: {
            status,
            finishedAt: new Date(),
            durationMs,
            jobsFound: rawJobs.length,
            jobsCreated: ingestionResult.created.length,
            jobsUpdated: ingestionResult.updated.length,
            jobsSkipped: skipped,
            jobsFailed: ingestionResult.failed,
          },
        }),
        this.prisma.jobSource.update({
          where: { id: source.id },
          data: { lastRunAt: new Date(), lastSuccessAt: new Date(), consecutiveFailures: 0 },
        }),
      ]);

      runLogger.info(
        `Run finished: ${ingestionResult.created.length} created, ${ingestionResult.updated.length} updated, ${skipped} skipped`,
        { durationMs },
      );

      // Hand off to the notification queue — the final stage of the workflow.
      await this.queue.enqueueJobMatching({ jobIds: ingestionResult.created, runId: run.id });

      return {
        runId: run.id,
        sourceSlug: source.slug,
        jobsFound: rawJobs.length,
        jobsCreated: ingestionResult.created.length,
        jobsUpdated: ingestionResult.updated.length,
        jobsSkipped: skipped,
        jobsFailed: ingestionResult.failed,
        durationMs,
      };
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown scraper error';
      await this.handleFailure(run.id, source.id, source.slug, message, startedAt);
      // Rethrow so BullMQ applies its retry/backoff policy.
      throw error;
    }
  }

  /**
   * Rate limiting / IP blocks are expected, transient third-party behavior —
   * not a sign the source is misconfigured or the pipeline is broken. Matches
   * the wording JobSpyClient and the sidecar already use for 502s and empty
   * per-board warnings (see jobspy.client.ts / jobspy.adapter.ts).
   */
  private isRateLimitError(message: string): boolean {
    return /rate limit|rate-limit|too many requests|\b429\b|ip block|blocked/i.test(message);
  }

  private async handleFailure(
    runId: string,
    sourceId: string,
    sourceSlug: string,
    message: string,
    startedAt: number,
  ): Promise<void> {
    const rateLimited = this.isRateLimitError(message);

    if (rateLimited) {
      // Readable, distinct signal so this doesn't get mistaken for a config or
      // outage failure while triaging admin logs.
      this.logs.write(LogLevel.WARN, `Scrape rate-limited/blocked, will retry: ${message}`, {
        runId,
        sourceId,
      });
    } else {
      this.logs.write(LogLevel.ERROR, `Scrape failed: ${message}`, { runId, sourceId });
    }

    // Rate limits don't indicate a broken source, so they don't count toward
    // auto-disable — only genuine failures (config errors, sidecar outages, ...)
    // do. BullMQ still retries either way; only the disable threshold differs.
    const source = await this.prisma.jobSource.update({
      where: { id: sourceId },
      data: {
        lastRunAt: new Date(),
        ...(rateLimited ? {} : { consecutiveFailures: { increment: 1 } }),
      },
      select: { consecutiveFailures: true },
    });

    await this.prisma.scraperRun.update({
      where: { id: runId },
      data: {
        status: ScraperRunStatus.FAILED,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        errorMessage: message.slice(0, 1000),
      },
    });

    // A source that keeps failing is disabled rather than left hammering an
    // endpoint that may have blocked us; admins re-enable it after fixing config.
    if (!rateLimited && source.consecutiveFailures >= this.maxConsecutiveFailures) {
      await this.prisma.jobSource.update({
        where: { id: sourceId },
        data: { isEnabled: false },
      });
      await this.queue.removeSourceSchedule(sourceSlug);
      this.logs.writeSystemLog(
        LogLevel.ERROR,
        'scraper',
        `Source ${sourceSlug} auto-disabled after ${source.consecutiveFailures} consecutive failures`,
      );
    }
  }

  /** Manual trigger used by the admin API. */
  async triggerSource(sourceId: string, fullSync = false): Promise<{ queueJobId: string | null }> {
    const source = await this.prisma.jobSource.findUnique({
      where: { id: sourceId },
      select: { id: true, slug: true },
    });
    if (!source) {
      throw new NotFoundException('Job source not found');
    }

    const job = await this.queue.enqueueScrapeSource({
      sourceId: source.id,
      sourceSlug: source.slug,
      trigger: ScraperTrigger.MANUAL,
      fullSync,
    });

    return { queueJobId: job.id ?? null };
  }

  /**
   * Marks postings that stopped appearing in their source as EXPIRED.
   * Called by the maintenance worker; `staleDays` is deliberately generous so a
   * single failed crawl cannot wipe out a source's listings.
   */
  async expireStaleJobs(staleDays = 14): Promise<number> {
    const cutoff = new Date(Date.now() - staleDays * 24 * 3600 * 1000);
    const result = await this.prisma.job.updateMany({
      where: {
        status: JobStatus.ACTIVE,
        lastSeenAt: { lt: cutoff },
        sourceId: { not: null },
      },
      data: { status: JobStatus.EXPIRED },
    });

    if (result.count > 0) {
      this.logs.writeSystemLog(
        LogLevel.INFO,
        'maintenance',
        `Expired ${result.count} jobs unseen for ${staleDays}+ days`,
      );
    }
    return result.count;
  }

  /** Also expires jobs whose stated application deadline has passed. */
  async expirePastDeadlineJobs(): Promise<number> {
    const result = await this.prisma.job.updateMany({
      where: { status: JobStatus.ACTIVE, expiresAt: { lt: new Date() } },
      data: { status: JobStatus.EXPIRED },
    });
    return result.count;
  }

  async getSourceHealth(): Promise<SourceHealth[]> {
    const sources = await this.prisma.jobSource.findMany({ orderBy: { name: 'asc' } });
    const since = new Date(Date.now() - 24 * 3600 * 1000);

    return Promise.all(
      sources.map(async (source) => {
        const [lastRun, runs24h] = await Promise.all([
          this.prisma.scraperRun.findFirst({
            where: { sourceId: source.id },
            orderBy: { startedAt: 'desc' },
          }),
          this.prisma.scraperRun.findMany({
            where: { sourceId: source.id, startedAt: { gte: since } },
            select: { status: true, jobsCreated: true, jobsUpdated: true },
          }),
        ]);

        const successful = runs24h.filter(
          (run) =>
            run.status === ScraperRunStatus.SUCCESS || run.status === ScraperRunStatus.PARTIAL,
        ).length;

        return {
          source: {
            ...source,
            config: (source.config ?? {}) as Record<string, unknown>,
            type: source.type,
            lastRunAt: source.lastRunAt?.toISOString() ?? null,
            lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null,
            createdAt: source.createdAt.toISOString(),
            updatedAt: source.updatedAt.toISOString(),
          },
          lastRun: lastRun
            ? {
                ...lastRun,
                startedAt: lastRun.startedAt.toISOString(),
                finishedAt: lastRun.finishedAt?.toISOString() ?? null,
              }
            : null,
          successRate24h: runs24h.length === 0 ? 0 : successful / runs24h.length,
          jobsIngested24h: runs24h.reduce(
            (total, run) => total + run.jobsCreated + run.jobsUpdated,
            0,
          ),
          isHealthy:
            source.isEnabled &&
            source.consecutiveFailures === 0 &&
            (runs24h.length === 0 || successful > 0),
        } as SourceHealth;
      }),
    );
  }
}
