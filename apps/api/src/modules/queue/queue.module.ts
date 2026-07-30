import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@ai-career/shared';
import { parseRedisUrl } from '../redis/redis.util';
import { QueueService } from './queue.service';

/**
 * Registers the three BullMQ queues used by Phase 2:
 *  - scraper:       fetch + ingest jobs from a source
 *  - notifications: alert matching, digests, email delivery
 *  - maintenance:   stale-job expiry, daily stat rollups, log pruning
 *
 * Producers live in the API process; consumers live in the worker process
 * (see src/worker.ts and modules/workers/workers.module.ts).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedisUrl(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
        prefix: config.get<string>('QUEUE_PREFIX', 'aicareer'),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          // Keep a short success history (observability) and a week of failures (triage).
          removeOnComplete: { age: 3600, count: 200 },
          removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SCRAPER },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.MAINTENANCE },
    ),
  ],
  providers: [QueueService],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
