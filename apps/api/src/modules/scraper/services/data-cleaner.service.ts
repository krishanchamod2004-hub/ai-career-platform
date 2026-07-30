import { Injectable, Logger } from '@nestjs/common';
import { SalaryPeriod } from '@ai-career/shared';
import type { ParsedJob } from '../scraper.types';
import { normalizeWhitespace, truncate } from '../parsers/text.util';

const MAX_DESCRIPTION_LENGTH = 20_000;
const MAX_TITLE_LENGTH = 200;
const MIN_DESCRIPTION_LENGTH = 40;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 180;

export interface CleanOutcome {
  jobs: ParsedJob[];
  rejected: Array<{ title: string; reason: string }>;
}

/**
 * Stage 3 of the pipeline: enforces data quality before anything is persisted.
 *
 * Rejects unusable rows (no title/company/url, junk descriptions), repairs what
 * can be repaired (whitespace, swapped salary bounds, future dates), and drops
 * values that would poison filters (implausible salaries, stale postings).
 */
@Injectable()
export class DataCleanerService {
  private readonly logger = new Logger(DataCleanerService.name);

  clean(jobs: ParsedJob[]): CleanOutcome {
    const cleaned: ParsedJob[] = [];
    const rejected: Array<{ title: string; reason: string }> = [];

    for (const job of jobs) {
      const result = this.cleanOne(job);
      if ('reason' in result) {
        rejected.push({ title: job.title || '(untitled)', reason: result.reason });
        continue;
      }
      cleaned.push(result.job);
    }

    if (rejected.length > 0) {
      this.logger.debug(`Cleaner rejected ${rejected.length}/${jobs.length} postings`);
    }

    return { jobs: cleaned, rejected };
  }

  private cleanOne(job: ParsedJob): { job: ParsedJob } | { reason: string } {
    const title = truncate(normalizeWhitespace(job.title), MAX_TITLE_LENGTH);
    const companyName = normalizeWhitespace(job.companyName);

    if (!title) {
      return { reason: 'missing title' };
    }
    if (!companyName || !job.companySlug) {
      return { reason: 'missing company' };
    }
    if (!job.url || !/^https?:\/\//i.test(job.url)) {
      return { reason: 'missing or invalid url' };
    }
    if (!job.sourceJobId) {
      return { reason: 'missing source job id' };
    }

    const description = job.description.replace(/\r/g, '').trim().slice(0, MAX_DESCRIPTION_LENGTH);
    if (description.length < MIN_DESCRIPTION_LENGTH) {
      return { reason: 'description too short' };
    }

    const postedAt = this.sanitizePostedAt(job.postedAt);
    if (postedAt && Date.now() - postedAt.getTime() > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
      return { reason: `older than ${MAX_AGE_DAYS} days` };
    }

    const salary = this.sanitizeSalary(job);

    return {
      job: {
        ...job,
        title,
        companyName,
        description,
        descriptionHtml: job.descriptionHtml
          ? job.descriptionHtml.slice(0, MAX_DESCRIPTION_LENGTH)
          : null,
        location: job.location ? truncate(normalizeWhitespace(job.location), 160) : null,
        city: job.city ? truncate(normalizeWhitespace(job.city), 80) : null,
        region: job.region ? truncate(normalizeWhitespace(job.region), 80) : null,
        country: job.country ? truncate(normalizeWhitespace(job.country), 80) : null,
        skills: this.uniqueStrings(job.skills, 25),
        benefits: this.uniqueStrings(job.benefits, 15),
        tags: this.uniqueStrings(job.tags, 15),
        minYearsExperience:
          job.minYearsExperience !== null && job.minYearsExperience >= 0 && job.minYearsExperience <= 30
            ? job.minYearsExperience
            : null,
        ...salary,
        postedAt,
      },
    };
  }

  /** Clamps clock-skewed future dates; leaves nulls alone (ingestion defaults them). */
  private sanitizePostedAt(postedAt: Date | null): Date | null {
    if (!postedAt || Number.isNaN(postedAt.getTime())) {
      return null;
    }
    if (postedAt.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
      return new Date();
    }
    return postedAt;
  }

  /**
   * Salary sanity rules: swap inverted bounds, drop equal-to-zero values, and
   * discard ranges outside plausible bounds for the detected period so the
   * salary filter never returns nonsense.
   */
  private sanitizeSalary(job: ParsedJob): Pick<
    ParsedJob,
    'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod' | 'salaryText'
  > {
    let min = job.salaryMin;
    let max = job.salaryMax;

    if (min !== null && max !== null && min > max) {
      [min, max] = [max, min];
    }
    if (min !== null && min <= 0) min = null;
    if (max !== null && max <= 0) max = null;

    const period = job.salaryPeriod ?? (min || max ? SalaryPeriod.YEARLY : null);
    const bounds = period ? PLAUSIBLE_BOUNDS[period] : null;

    if (bounds) {
      if (min !== null && (min < bounds.min || min > bounds.max)) min = null;
      if (max !== null && (max < bounds.min || max > bounds.max)) max = null;
    }

    // A range where both ends vanished carries no usable currency/period either.
    const hasSalary = min !== null || max !== null;

    return {
      salaryMin: min,
      salaryMax: max,
      salaryCurrency: hasSalary ? (job.salaryCurrency ?? 'USD') : null,
      salaryPeriod: hasSalary ? period : null,
      salaryText: job.salaryText ? truncate(normalizeWhitespace(job.salaryText), 120) : null,
    };
  }

  private uniqueStrings(values: string[], limit: number): string[] {
    return [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))].slice(
      0,
      limit,
    );
  }
}

const PLAUSIBLE_BOUNDS: Record<SalaryPeriod, { min: number; max: number }> = {
  [SalaryPeriod.HOURLY]: { min: 3, max: 1_000 },
  [SalaryPeriod.DAILY]: { min: 40, max: 10_000 },
  [SalaryPeriod.WEEKLY]: { min: 200, max: 50_000 },
  [SalaryPeriod.MONTHLY]: { min: 300, max: 200_000 },
  [SalaryPeriod.YEARLY]: { min: 8_000, max: 2_000_000 },
};
