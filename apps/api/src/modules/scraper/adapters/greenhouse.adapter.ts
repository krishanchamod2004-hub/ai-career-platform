import { Injectable } from '@nestjs/common';
import { JobSourceType } from '@ai-career/shared';
import { ScraperHttpClient } from './scraper-http.client';
import type { AdapterContext, JobSourceAdapter, RawJob } from './job-source-adapter.interface';

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at?: string;
  /** HTML-escaped description (only present with ?content=true). */
  content?: string;
  absolute_url: string;
  location?: { name?: string };
  offices?: Array<{ name?: string; location?: string }>;
  departments?: Array<{ name?: string }>;
  metadata?: Array<{ name?: string; value?: unknown }>;
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[];
}

/**
 * Greenhouse public job board API.
 *
 * Endpoint: https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true
 * Config:   { "boards": [{ "slug": "stripe", "name": "Stripe" }, "figma"] }
 *
 * One request per configured board; each board maps to a single company.
 */
@Injectable()
export class GreenhouseAdapter implements JobSourceAdapter {
  readonly type = JobSourceType.GREENHOUSE;

  private static readonly BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';

  constructor(private readonly http: ScraperHttpClient) {}

  async fetchJobs(context: AdapterContext): Promise<RawJob[]> {
    const boards = this.resolveBoards(context.config);
    if (boards.length === 0) {
      context.logger.warn('Greenhouse source has no boards configured', {
        config: context.config,
      });
      return [];
    }

    const results: RawJob[] = [];

    for (const board of boards) {
      const url = `${GreenhouseAdapter.BASE_URL}/${encodeURIComponent(board.slug)}/jobs?content=true`;
      try {
        const data = await this.http.getJson<GreenhouseResponse>(url, {
          requestsPerMinute: context.requestsPerMinute,
        });
        const jobs = data.jobs ?? [];
        context.logger.info(`Greenhouse board ${board.slug} returned ${jobs.length} postings`);

        for (const job of jobs) {
          const postedAt = job.updated_at ? new Date(job.updated_at) : null;
          if (!context.fullSync && context.since && postedAt && postedAt < context.since) {
            continue;
          }
          results.push(this.toRawJob(job, board, postedAt));
        }
      } catch (error) {
        // A single broken board must not abort the whole run.
        context.logger.error(`Greenhouse board ${board.slug} failed`, {
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  private toRawJob(
    job: GreenhouseJob,
    board: { slug: string; name: string },
    postedAt: Date | null,
  ): RawJob {
    const locationText =
      job.location?.name ?? job.offices?.find((office) => office.name)?.name ?? null;

    return {
      sourceJobId: `greenhouse:${board.slug}:${job.id}`,
      title: job.title,
      companyName: board.name,
      companyWebsite: null,
      descriptionHtml: job.content ? decodeHtmlEntities(job.content) : null,
      locationText,
      employmentType: this.readMetadata(job, ['employment type', 'job type']),
      workplaceType: this.readMetadata(job, ['workplace type', 'remote', 'work model']),
      department: job.departments?.find((department) => department.name)?.name ?? null,
      salaryText: this.readMetadata(job, ['salary', 'compensation', 'salary range']),
      postedAt,
      url: job.absolute_url,
      applyUrl: job.absolute_url,
      tags: job.departments?.map((department) => department.name ?? '').filter(Boolean) ?? [],
    };
  }

  private readMetadata(job: GreenhouseJob, names: string[]): string | null {
    const match = job.metadata?.find((entry) =>
      names.includes((entry.name ?? '').trim().toLowerCase()),
    );
    if (!match || match.value === null || match.value === undefined) {
      return null;
    }
    return Array.isArray(match.value) ? match.value.join(', ') : String(match.value);
  }

  /** Accepts `["stripe"]` or `[{ slug, name }]` for boards whose display name differs. */
  private resolveBoards(config: Record<string, unknown>): Array<{ slug: string; name: string }> {
    const raw = config.boards;
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
      .filter((board): board is { slug: string; name: string } => board !== null);
  }
}

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Greenhouse returns the description as an HTML-escaped string, so `&lt;p&gt;`
 * must be unescaped before the HTML-to-text parser can read it.
 */
export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
