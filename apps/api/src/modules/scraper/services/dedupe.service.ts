import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CleanJob, ParsedJob } from '../scraper.types';
import { canonicalizeCompanyName, slugify } from '../parsers/text.util';

/**
 * Stage 4 of the pipeline: identity and change detection.
 *
 * - `dedupeKey`  — cross-source fingerprint (company + normalized title + place).
 *                  The same role posted on Greenhouse and RemoteOK collapses to one row.
 * - `contentHash`— hash of the fields users actually see; lets ingestion skip
 *                  untouched postings instead of writing on every crawl.
 */
@Injectable()
export class DedupeService {
  /** Attaches slug + hashes and removes duplicates within the same batch. */
  prepare(jobs: ParsedJob[]): { jobs: CleanJob[]; duplicatesInBatch: number } {
    const seen = new Set<string>();
    const prepared: CleanJob[] = [];
    let duplicatesInBatch = 0;

    for (const job of jobs) {
      const dedupeKey = this.computeDedupeKey(job);
      if (seen.has(dedupeKey)) {
        duplicatesInBatch += 1;
        continue;
      }
      seen.add(dedupeKey);
      prepared.push({
        ...job,
        dedupeKey,
        contentHash: this.computeContentHash(job),
        slug: this.buildSlug(job, dedupeKey),
      });
    }

    return { jobs: prepared, duplicatesInBatch };
  }

  computeDedupeKey(job: ParsedJob): string {
    const company = canonicalizeCompanyName(job.companyName) || job.companySlug;
    const title = this.normalizeTitle(job.title);
    // Remote roles are location-agnostic; otherwise city (or country) disambiguates
    // genuinely different openings for the same title at the same company.
    const place = job.isRemote ? 'remote' : (job.city ?? job.country ?? 'unspecified').toLowerCase();
    return this.sha256(`${company}|${title}|${place}`).slice(0, 40);
  }

  computeContentHash(job: ParsedJob): string {
    const payload = [
      job.title,
      job.description,
      job.location ?? '',
      job.salaryMin ?? '',
      job.salaryMax ?? '',
      job.salaryCurrency ?? '',
      job.salaryPeriod ?? '',
      job.jobType ?? '',
      job.experienceLevel ?? '',
      job.workModel ?? '',
      job.isRemote ? '1' : '0',
      job.skills.join(','),
      job.benefits.join(','),
      job.applyUrl ?? job.url,
    ].join('\u0001');
    return this.sha256(payload);
  }

  /**
   * Titles differ cosmetically across boards ("Senior Engineer (Remote)" vs
   * "Senior Engineer, Remote"), so qualifiers and punctuation are stripped before
   * fingerprinting.
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\b(remote|hybrid|on-?site|full-?time|part-?time|contract|f\/m\/d|m\/f\/d|m\/w\/d|all genders)\b/g, ' ')
      .replace(/[^a-z0-9+#.\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildSlug(job: ParsedJob, dedupeKey: string): string {
    const base = slugify(`${job.title}-at-${job.companyName}`) || 'job';
    return `${base}-${dedupeKey.slice(0, 8)}`;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }
}
