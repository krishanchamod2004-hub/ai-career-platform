import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JobSourceType, ScraperTrigger } from '@ai-career/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { AdapterRegistry } from '../adapters/adapter.registry';

export interface UpsertJobSourceInput {
  slug?: string;
  name?: string;
  type?: JobSourceType;
  config?: Record<string, unknown>;
  isEnabled?: boolean;
  cronExpression?: string;
  requestsPerMinute?: number;
  priority?: number;
}

/**
 * CRUD for ingestion sources. Any change that affects scheduling immediately
 * re-registers (or removes) the source's repeatable BullMQ job so the DB stays
 * the single source of truth for what runs and how often.
 */
@Injectable()
export class JobSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly registry: AdapterRegistry,
  ) {}

  list() {
    return this.prisma.jobSource.findMany({ orderBy: [{ priority: 'desc' }, { name: 'asc' }] });
  }

  async get(id: string) {
    const source = await this.prisma.jobSource.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException('Job source not found');
    }
    return source;
  }

  async create(input: UpsertJobSourceInput) {
    if (!input.slug || !input.name || !input.type) {
      throw new BadRequestException('slug, name and type are required');
    }
    if (!this.registry.has(input.type)) {
      throw new BadRequestException(
        `No adapter registered for "${input.type}". Available: ${this.registry.listTypes().join(', ')}`,
      );
    }

    const source = await this.prisma.jobSource.create({
      data: {
        slug: input.slug,
        name: input.name,
        type: input.type,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
        isEnabled: input.isEnabled ?? true,
        ...(input.cronExpression ? { cronExpression: input.cronExpression } : {}),
        ...(input.requestsPerMinute ? { requestsPerMinute: input.requestsPerMinute } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
      },
    });

    await this.syncSchedule(source.id);
    return source;
  }

  async update(id: string, input: UpsertJobSourceInput) {
    await this.get(id);

    if (input.type && !this.registry.has(input.type)) {
      throw new BadRequestException(`No adapter registered for "${input.type}"`);
    }

    const source = await this.prisma.jobSource.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.config !== undefined ? { config: input.config as Prisma.InputJsonValue } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.cronExpression !== undefined ? { cronExpression: input.cronExpression } : {}),
        ...(input.requestsPerMinute !== undefined
          ? { requestsPerMinute: input.requestsPerMinute }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        // Re-enabling a source clears the failure counter that disabled it.
        ...(input.isEnabled === true ? { consecutiveFailures: 0 } : {}),
      },
    });

    await this.syncSchedule(source.id);
    return source;
  }

  async remove(id: string) {
    const source = await this.get(id);
    await this.queue.removeSourceSchedule(source.slug);
    await this.prisma.jobSource.delete({ where: { id } });
    return { message: 'Job source deleted' };
  }

  /** Aligns the queue's repeatable jobs with the source's current DB state. */
  async syncSchedule(id: string): Promise<void> {
    const source = await this.get(id);

    if (!source.isEnabled) {
      await this.queue.removeSourceSchedule(source.slug);
      return;
    }

    await this.queue.upsertSourceSchedule(
      {
        sourceId: source.id,
        sourceSlug: source.slug,
        trigger: ScraperTrigger.CRON,
      },
      source.cronExpression,
    );
  }

  async syncAllSchedules(): Promise<number> {
    const sources = await this.prisma.jobSource.findMany({ where: { isEnabled: true } });
    for (const source of sources) {
      await this.queue.upsertSourceSchedule(
        { sourceId: source.id, sourceSlug: source.slug, trigger: ScraperTrigger.CRON },
        source.cronExpression,
      );
    }
    return sources.length;
  }
}
