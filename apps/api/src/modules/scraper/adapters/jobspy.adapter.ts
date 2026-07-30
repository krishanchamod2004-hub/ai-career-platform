import { Injectable } from '@nestjs/common';
import { JOBSPY_SITE_BY_SOURCE_TYPE, JobSourceType } from '@ai-career/shared';
import { JobSpyClient, type JobSpyRawJob, type JobSpySearchRequest } from './jobspy.client';
import type { AdapterContext, JobSourceAdapter, RawJob } from './job-source-adapter.interface';

/**
 * JobSource.config shape for every JobSpy-backed source.
 *
 * ```json
 * {
 *   "searchTerms": ["software engineer", "backend engineer"],
 *   "location": "New York, NY",
 *   "resultsWanted": 50,
 *   "countryIndeed": "USA",
 *   "isRemote": true,
 *   "distance": 50
 * }
 * ```
 */
interface JobSpySourceConfig {
  searchTerms?: unknown;
  searchTerm?: unknown;
  location?: unknown;
  resultsWanted?: unknown;
  distance?: unknown;
  jobType?: unknown;
  isRemote?: unknown;
  hoursOld?: unknown;
  offset?: unknown;
  countryIndeed?: unknown;
}

/** Ceiling on the incremental `hours_old` window (30 days, matching the sidecar). */
const MAX_HOURS_OLD = 24 * 30;

/**
 * Base adapter for boards served by the Python JobSpy sidecar.
 *
 * Like every other adapter it only fetches and extracts: the returned RawJob[]
 * flows through the existing JobParserService → DataCleanerService →
 * DedupeService → JobIngestionService chain, so JobSpy postings get the same
 * salary/location/skill normalization and the same cross-source dedupe as
 * Greenhouse and Lever rows.
 *
 * One concrete subclass per board because AdapterRegistry maps exactly one
 * JobSourceType to one adapter instance, which keeps per-board cron cadence,
 * rate limits and failure counters independent — LinkedIn getting blocked must
 * not disable Indeed.
 */
export abstract class BaseJobSpyAdapter implements JobSourceAdapter {
  abstract readonly type: JobSourceType;

  constructor(protected readonly client: JobSpyClient) {}

  /** JobSpy's `site_name` value for this board. */
  protected get site(): string {
    return JOBSPY_SITE_BY_SOURCE_TYPE[this.type as keyof typeof JOBSPY_SITE_BY_SOURCE_TYPE];
  }

  async fetchJobs(context: AdapterContext): Promise<RawJob[]> {
    const config = (context.config ?? {}) as JobSpySourceConfig;
    const searchTerms = this.resolveSearchTerms(config);

    if (searchTerms.length === 0) {
      context.logger.warn(`${this.type} source has no searchTerms configured`, {
        config: context.config,
      });
      return [];
    }

    // A job can match several search terms; key by sourceJobId so the same
    // posting is fetched once per run rather than relying on downstream dedupe.
    const bySourceJobId = new Map<string, RawJob>();
    const failures: string[] = [];

    for (const searchTerm of searchTerms) {
      const request = this.buildRequest(searchTerm, config, context);
      try {
        const response = await this.client.search(request);

        for (const warning of response.warnings) {
          context.logger.warn(`${this.type} "${searchTerm}": ${warning}`);
        }
        context.logger.info(
          `${this.type} "${searchTerm}" returned ${response.total} posting(s) in ${response.elapsedMs}ms`,
          { skipped: response.skipped },
        );

        for (const job of response.jobs) {
          const mapped = this.toRawJob(job);
          if (!this.isWithinWatermark(mapped, context)) {
            continue;
          }
          if (!bySourceJobId.has(mapped.sourceJobId)) {
            bySourceJobId.set(mapped.sourceJobId, mapped);
          }
        }
      } catch (error) {
        // One bad search term must not discard the postings already collected.
        const message = (error as Error).message;
        failures.push(`${searchTerm}: ${message}`);
        context.logger.error(`${this.type} search "${searchTerm}" failed`, { error: message });
      }
    }

    // Every term failing is a source-level outage (sidecar down, token wrong,
    // IP blocked). Throw so the run is recorded FAILED and BullMQ retries with
    // backoff — returning [] would look like "the board has no jobs" and would
    // eventually expire healthy listings via the staleness sweep.
    if (failures.length === searchTerms.length) {
      throw new Error(
        `All ${failures.length} JobSpy search(es) failed for ${this.type} — ${failures[0]}`,
      );
    }

    return [...bySourceJobId.values()];
  }

  private buildRequest(
    searchTerm: string,
    config: JobSpySourceConfig,
    context: AdapterContext,
  ): JobSpySearchRequest {
    const jobType = this.asString(config.jobType);
    const isRemote = this.asBoolean(config.isRemote);

    const request: JobSpySearchRequest = {
      search_term: searchTerm,
      sites: [this.site],
      location: this.asString(config.location) ?? undefined,
      results_wanted: this.asNumber(config.resultsWanted) ?? undefined,
      distance: this.asNumber(config.distance) ?? undefined,
      job_type: jobType ?? undefined,
      is_remote: isRemote ?? undefined,
      offset: this.asNumber(config.offset) ?? undefined,
      country_indeed: this.asString(config.countryIndeed) ?? 'USA',
    };

    // Indeed, Glassdoor and LinkedIn accept only ONE of hours_old or
    // job_type/is_remote per search; the sidecar rejects the combination with a
    // 422, so an explicit board filter wins over the incremental window.
    const canUseHoursOld = jobType === null && isRemote === null;
    if (canUseHoursOld) {
      const hoursOld = this.asNumber(config.hoursOld) ?? this.deriveHoursOld(context);
      if (hoursOld !== null) {
        request.hours_old = Math.min(MAX_HOURS_OLD, Math.max(1, hoursOld));
      }
    }

    return request;
  }

  /**
   * Converts the pipeline's `since` watermark into JobSpy's `hours_old`, so an
   * incremental run asks the board for less data instead of filtering locally.
   */
  private deriveHoursOld(context: AdapterContext): number | null {
    if (context.fullSync || !context.since) {
      return null;
    }
    const hours = Math.ceil((Date.now() - context.since.getTime()) / 3_600_000);
    return hours > 0 ? hours : null;
  }

  /** Boards round `hours_old` up to whole days, so re-check the watermark locally. */
  private isWithinWatermark(job: RawJob, context: AdapterContext): boolean {
    if (context.fullSync || !context.since || !job.postedAt) {
      return true;
    }
    return job.postedAt >= context.since;
  }

  private toRawJob(job: JobSpyRawJob): RawJob {
    // `site` is intentionally dropped: it is only used for source attribution
    // and RawJob has no such field.
    const postedAt = job.postedAt ? new Date(job.postedAt) : null;

    return {
      sourceJobId: job.sourceJobId,
      title: job.title,
      companyName: job.companyName,
      companyWebsite: job.companyWebsite ?? null,
      companyLogoUrl: job.companyLogoUrl ?? null,
      descriptionHtml: job.descriptionHtml ?? null,
      descriptionText: job.descriptionText ?? null,
      locationText: job.locationText ?? null,
      isRemote: job.isRemote ?? null,
      employmentType: job.employmentType ?? null,
      workplaceType: job.workplaceType ?? null,
      department: job.department ?? null,
      salaryText: job.salaryText ?? null,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      salaryCurrency: job.salaryCurrency ?? null,
      postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
      url: job.url,
      applyUrl: job.applyUrl ?? null,
      tags: job.tags ?? [],
    };
  }

  /** Accepts `searchTerms: [...]` or a single `searchTerm: "..."`. */
  private resolveSearchTerms(config: JobSpySourceConfig): string[] {
    const raw = Array.isArray(config.searchTerms)
      ? config.searchTerms
      : config.searchTerm !== undefined
        ? [config.searchTerm]
        : [];

    const terms = raw
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);

    return [...new Set(terms)];
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private asBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }
}

@Injectable()
export class LinkedInAdapter extends BaseJobSpyAdapter {
  readonly type = JobSourceType.LINKEDIN;
}

@Injectable()
export class IndeedAdapter extends BaseJobSpyAdapter {
  readonly type = JobSourceType.INDEED;
}

@Injectable()
export class GlassdoorAdapter extends BaseJobSpyAdapter {
  readonly type = JobSourceType.GLASSDOOR;
}

@Injectable()
export class ZipRecruiterAdapter extends BaseJobSpyAdapter {
  readonly type = JobSourceType.ZIPRECRUITER;
}
