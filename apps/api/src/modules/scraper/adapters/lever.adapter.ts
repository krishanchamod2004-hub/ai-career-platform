import { Injectable } from '@nestjs/common';
import { JobSourceType } from '@ai-career/shared';
import { ScraperHttpClient } from './scraper-http.client';
import type { AdapterContext, JobSourceAdapter, RawJob } from './job-source-adapter.interface';

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  country?: string;
  description?: string;
  descriptionPlain?: string;
  additional?: string;
  additionalPlain?: string;
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
  };
}

/**
 * Lever public postings API.
 *
 * Endpoint: https://api.lever.co/v0/postings/{company}?mode=json
 * Config:   { "companies": [{ "slug": "netflix", "name": "Netflix" }, "ramp"] }
 */
@Injectable()
export class LeverAdapter implements JobSourceAdapter {
  readonly type = JobSourceType.LEVER;

  private static readonly BASE_URL = 'https://api.lever.co/v0/postings';

  constructor(private readonly http: ScraperHttpClient) {}

  async fetchJobs(context: AdapterContext): Promise<RawJob[]> {
    const companies = this.resolveCompanies(context.config);
    if (companies.length === 0) {
      context.logger.warn('Lever source has no companies configured', { config: context.config });
      return [];
    }

    const results: RawJob[] = [];

    for (const company of companies) {
      const url = `${LeverAdapter.BASE_URL}/${encodeURIComponent(company.slug)}?mode=json`;
      try {
        const postings = await this.http.getJson<LeverPosting[]>(url, {
          requestsPerMinute: context.requestsPerMinute,
        });
        const list = Array.isArray(postings) ? postings : [];
        context.logger.info(`Lever company ${company.slug} returned ${list.length} postings`);

        for (const posting of list) {
          const postedAt = posting.createdAt ? new Date(posting.createdAt) : null;
          if (!context.fullSync && context.since && postedAt && postedAt < context.since) {
            continue;
          }
          results.push(this.toRawJob(posting, company, postedAt));
        }
      } catch (error) {
        context.logger.error(`Lever company ${company.slug} failed`, {
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  private toRawJob(
    posting: LeverPosting,
    company: { slug: string; name: string },
    postedAt: Date | null,
  ): RawJob {
    const descriptionHtml = [posting.description, posting.additional]
      .filter(Boolean)
      .join('\n') || null;
    const descriptionText = [posting.descriptionPlain, posting.additionalPlain]
      .filter(Boolean)
      .join('\n') || null;

    const workplaceType = posting.workplaceType ?? null;
    const tags = [posting.categories?.team, posting.categories?.department].filter(
      (value): value is string => Boolean(value),
    );

    return {
      sourceJobId: `lever:${company.slug}:${posting.id}`,
      title: posting.text,
      companyName: company.name,
      descriptionHtml,
      descriptionText,
      locationText:
        posting.categories?.location ??
        posting.categories?.allLocations?.join(' / ') ??
        posting.country ??
        null,
      isRemote: workplaceType ? workplaceType.toLowerCase() === 'remote' : null,
      employmentType: posting.categories?.commitment ?? null,
      workplaceType,
      department: posting.categories?.department ?? null,
      salaryMin: posting.salaryRange?.min ?? null,
      salaryMax: posting.salaryRange?.max ?? null,
      salaryCurrency: posting.salaryRange?.currency ?? null,
      salaryText: posting.salaryRange?.interval ?? null,
      postedAt,
      url: posting.hostedUrl ?? posting.applyUrl ?? `https://jobs.lever.co/${company.slug}/${posting.id}`,
      applyUrl: posting.applyUrl ?? posting.hostedUrl ?? null,
      tags,
    };
  }

  private resolveCompanies(config: Record<string, unknown>): Array<{ slug: string; name: string }> {
    const raw = config.companies ?? config.boards;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((entry) => {
        if (typeof entry === 'string') {
          return { slug: entry, name: humanizeSlug(entry) };
        }
        if (entry && typeof entry === 'object' && 'slug' in entry) {
          const record = entry as { slug?: unknown; name?: unknown };
          const slug = typeof record.slug === 'string' ? record.slug : null;
          if (!slug) {
            return null;
          }
          return {
            slug,
            name: typeof record.name === 'string' ? record.name : humanizeSlug(slug),
          };
        }
        return null;
      })
      .filter((company): company is { slug: string; name: string } => company !== null);
  }
}

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
