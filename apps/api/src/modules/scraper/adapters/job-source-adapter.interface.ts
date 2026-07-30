import type { JobSourceType } from '@ai-career/shared';

/**
 * Lowest-common-denominator job shape every adapter must produce.
 * Adapters do transport + field extraction only — normalization, cleaning, and
 * deduplication happen downstream so all sources share identical semantics.
 */
export interface RawJob {
  /** Stable id from the upstream source. */
  sourceJobId: string;
  title: string;
  companyName: string;
  companyWebsite?: string | null;
  companyLogoUrl?: string | null;
  /** Raw HTML description, when the source provides one. */
  descriptionHtml?: string | null;
  /** Plain-text description, when the source provides one. */
  descriptionText?: string | null;
  locationText?: string | null;
  /** Set only when the source states it explicitly; otherwise inferred later. */
  isRemote?: boolean | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  department?: string | null;
  salaryText?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  postedAt?: Date | null;
  url: string;
  applyUrl?: string | null;
  tags?: string[];
}

export interface AdapterLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface AdapterContext {
  /** JobSource.config — adapter-specific (board slugs, tag filters, ...). */
  config: Record<string, unknown>;
  /** Requests-per-minute budget from JobSource.requestsPerMinute. */
  requestsPerMinute: number;
  /** Incremental watermark: skip postings older than this unless fullSync. */
  since?: Date | null;
  fullSync?: boolean;
  logger: AdapterLogger;
}

/**
 * Implement this interface and register the class in AdapterRegistry to add a
 * new job source. No other module needs to change.
 */
export interface JobSourceAdapter {
  readonly type: JobSourceType;
  fetchJobs(context: AdapterContext): Promise<RawJob[]>;
}
