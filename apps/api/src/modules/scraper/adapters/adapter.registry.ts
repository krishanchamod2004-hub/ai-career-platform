import { Injectable, NotFoundException } from '@nestjs/common';
import { JobSourceType } from '@ai-career/shared';
import { GreenhouseAdapter } from './greenhouse.adapter';
import { LeverAdapter } from './lever.adapter';
import { RemoteOkAdapter } from './remoteok.adapter';
import {
  GlassdoorAdapter,
  IndeedAdapter,
  LinkedInAdapter,
  ZipRecruiterAdapter,
} from './jobspy.adapter';
import type { JobSourceAdapter } from './job-source-adapter.interface';

/**
 * Maps JobSource.type -> adapter implementation.
 *
 * To add a source: implement JobSourceAdapter, add the class to the constructor
 * and to `adapters` below, extend the JobSourceType enum (shared + Prisma), then
 * insert a JobSource row. Nothing else in the pipeline changes.
 */
@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<JobSourceType, JobSourceAdapter>;

  constructor(
    greenhouse: GreenhouseAdapter,
    lever: LeverAdapter,
    remoteok: RemoteOkAdapter,
    // Served by the Python JobSpy sidecar; one instance per board so their
    // schedules, rate limits and failure counters stay independent.
    linkedin: LinkedInAdapter,
    indeed: IndeedAdapter,
    glassdoor: GlassdoorAdapter,
    zipRecruiter: ZipRecruiterAdapter,
  ) {
    this.adapters = new Map<JobSourceType, JobSourceAdapter>([
      [greenhouse.type, greenhouse],
      [lever.type, lever],
      [remoteok.type, remoteok],
      [linkedin.type, linkedin],
      [indeed.type, indeed],
      [glassdoor.type, glassdoor],
      [zipRecruiter.type, zipRecruiter],
    ]);
  }

  get(type: JobSourceType | string): JobSourceAdapter {
    const adapter = this.adapters.get(type as JobSourceType);
    if (!adapter) {
      throw new NotFoundException(`No scraper adapter registered for source type "${type}"`);
    }
    return adapter;
  }

  has(type: JobSourceType | string): boolean {
    return this.adapters.has(type as JobSourceType);
  }

  listTypes(): JobSourceType[] {
    return [...this.adapters.keys()];
  }
}
