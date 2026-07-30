import { Injectable, Logger } from '@nestjs/common';
import { LogLevel } from '@ai-career/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdapterLogger } from '../adapters/job-source-adapter.interface';

interface LogTarget {
  runId?: string | null;
  sourceId?: string | null;
}

/**
 * Persists scraper diagnostics so the admin dashboard can explain *why* a run
 * failed without shelling into container logs. Writes are fire-and-forget:
 * logging must never break or slow down ingestion.
 */
@Injectable()
export class ScraperLogService {
  private readonly logger = new Logger('Scraper');

  constructor(private readonly prisma: PrismaService) {}

  /** Adapter-facing logger bound to a specific run. */
  createRunLogger(target: LogTarget): AdapterLogger {
    return {
      debug: (message, context) => this.write(LogLevel.DEBUG, message, target, context),
      info: (message, context) => this.write(LogLevel.INFO, message, target, context),
      warn: (message, context) => this.write(LogLevel.WARN, message, target, context),
      error: (message, context) => this.write(LogLevel.ERROR, message, target, context),
    };
  }

  write(
    level: LogLevel,
    message: string,
    target: LogTarget = {},
    context?: Record<string, unknown>,
  ): void {
    const prefix = target.runId ? `[run ${target.runId.slice(0, 8)}]` : '';
    if (level === LogLevel.ERROR) {
      this.logger.error(`${prefix} ${message}`);
    } else if (level === LogLevel.WARN) {
      this.logger.warn(`${prefix} ${message}`);
    } else if (level === LogLevel.INFO) {
      this.logger.log(`${prefix} ${message}`);
    } else {
      this.logger.debug(`${prefix} ${message}`);
    }

    // DEBUG stays out of the database — it would dominate the table with no value.
    if (level === LogLevel.DEBUG) {
      return;
    }

    void this.prisma.scraperLog
      .create({
        data: {
          runId: target.runId ?? null,
          sourceId: target.sourceId ?? null,
          level,
          message: message.slice(0, 1000),
          context: context ? (context as object) : undefined,
        },
      })
      .catch((error: Error) => this.logger.warn(`Failed to persist scraper log: ${error.message}`));
  }

  /** Generic application-level log surfaced under Admin → System logs. */
  writeSystemLog(
    level: LogLevel,
    scope: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    void this.prisma.systemLog
      .create({
        data: {
          level,
          scope,
          message: message.slice(0, 1000),
          context: context ? (context as object) : undefined,
        },
      })
      .catch((error: Error) => this.logger.warn(`Failed to persist system log: ${error.message}`));
  }
}
