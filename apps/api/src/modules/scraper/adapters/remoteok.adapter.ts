import { Injectable } from '@nestjs/common';
import { JobSourceType } from '@ai-career/shared';
import { ScraperHttpClient } from './scraper-http.client';
import type { AdapterContext, JobSourceAdapter, RawJob } from './job-source-adapter.interface';

interface RemoteOkEntry {
  /** The first array element is a legal/attribution notice, not a job. */
  legal?: string;
  id?: string | number;
  slug?: string;
  company?: string;
  company_logo?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number | string;
  salary_max?: number | string;
  date?: string;
  url?: string;
  apply_url?: string;
  epoch?: number;
}

/**
 * RemoteOK public feed — a single request returning the latest remote postings
 * across all companies (so, unlike the ATS adapters, company names come per job).
 *
 * Endpoint: https://remoteok.com/api
 * Config:   { "url": "https://remoteok.com/api", "tags": ["dev"], "maxJobs": 500 }
 */
@Injectable()
export class RemoteOkAdapter implements JobSourceAdapter {
  readonly type = JobSourceType.REMOTEOK;

  private static readonly DEFAULT_URL = 'https://remoteok.com/api';

  constructor(private readonly http: ScraperHttpClient) {}

  async fetchJobs(context: AdapterContext): Promise<RawJob[]> {
    const url = typeof context.config.url === 'string' ? context.config.url : RemoteOkAdapter.DEFAULT_URL;
    const tagFilter = Array.isArray(context.config.tags)
      ? (context.config.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
      : [];
    const maxJobs = typeof context.config.maxJobs === 'number' ? context.config.maxJobs : 500;

    const payload = await this.http.getJson<RemoteOkEntry[]>(url, {
      requestsPerMinute: context.requestsPerMinute,
      // RemoteOK rejects requests without a descriptive User-Agent.
      headers: { Accept: 'application/json' },
    });

    const entries = (Array.isArray(payload) ? payload : []).filter(
      (entry) => !entry.legal && entry.position && entry.company,
    );
    context.logger.info(`RemoteOK returned ${entries.length} postings`);

    const results: RawJob[] = [];

    for (const entry of entries) {
      if (results.length >= maxJobs) {
        break;
      }

      const tags = (entry.tags ?? []).map((tag) => String(tag));
      if (tagFilter.length > 0 && !tags.some((tag) => tagFilter.includes(tag))) {
        continue;
      }

      const postedAt = entry.date
        ? new Date(entry.date)
        : entry.epoch
          ? new Date(Number(entry.epoch) * 1000)
          : null;
      if (!context.fullSync && context.since && postedAt && postedAt < context.since) {
        continue;
      }

      results.push({
        sourceJobId: `remoteok:${entry.id ?? entry.slug ?? entry.url}`,
        title: String(entry.position),
        companyName: String(entry.company),
        companyLogoUrl: entry.company_logo ?? null,
        descriptionHtml: entry.description ?? null,
        locationText: entry.location ?? 'Remote',
        isRemote: true,
        workplaceType: 'remote',
        salaryMin: toNumber(entry.salary_min),
        salaryMax: toNumber(entry.salary_max),
        salaryCurrency: 'USD',
        postedAt,
        url: entry.url ?? `https://remoteok.com/remote-jobs/${entry.slug ?? entry.id}`,
        applyUrl: entry.apply_url ?? entry.url ?? null,
        tags,
      });
    }

    return results;
  }
}

function toNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}
