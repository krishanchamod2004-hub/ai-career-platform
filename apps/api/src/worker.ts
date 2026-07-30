import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerAppModule } from './worker.module';

/**
 * Worker entrypoint — run with `pnpm --filter=@ai-career/api run worker`
 * (or the `worker` service in docker-compose).
 *
 * Uses createApplicationContext (no HTTP listener) and enables shutdown hooks so
 * in-flight BullMQ jobs finish before the process exits instead of being lost.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();

  logger.log('Worker started — consuming scraper, notifications, and maintenance queues');
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    logger.warn(
      'ENABLE_SCHEDULER is not "true": this worker will process jobs but register no cron schedules',
    );
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}, draining workers...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
