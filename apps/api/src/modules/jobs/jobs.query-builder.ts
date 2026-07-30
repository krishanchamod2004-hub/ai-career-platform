import type { Prisma } from '@prisma/client';
import { JobSortBy, JobStatus, SalaryPeriod } from '@ai-career/shared';
import type { QueryJobsDto } from './dto/query-jobs.dto';
import { decodeCursor, encodeCursor } from '../../common/pagination/pagination.util';

export interface JobQueryContext {
  /** Hours of early access the caller's plan grants (0 for anonymous/free). */
  earlyAccessHours: number;
  now?: Date;
  /** Admin/system callers bypass status and early-access restrictions. */
  bypassVisibility?: boolean;
}

/** Multipliers used to compare non-yearly salaries against a yearly filter. */
const ANNUALIZATION: Record<SalaryPeriod, number> = {
  [SalaryPeriod.HOURLY]: 2080,
  [SalaryPeriod.DAILY]: 260,
  [SalaryPeriod.WEEKLY]: 52,
  [SalaryPeriod.MONTHLY]: 12,
  [SalaryPeriod.YEARLY]: 1,
};

/**
 * Translates a validated search DTO into a Prisma `where` clause.
 *
 * Pure and side-effect free so the filter semantics (especially visibility and
 * salary comparison) can be unit tested without a database.
 */
export function buildJobWhere(query: QueryJobsDto, context: JobQueryContext): Prisma.JobWhereInput {
  const now = context.now ?? new Date();
  const and: Prisma.JobWhereInput[] = [];

  if (!context.bypassVisibility) {
    if (!query.includeExpired) {
      and.push({ status: JobStatus.ACTIVE });
    }
    // Early access: a listing is visible once `earlyAccessUntil` falls inside the
    // window the caller's plan unlocks (Premium sees everything immediately).
    // Skipped outright in development so newly-scraped jobs are visible to any
    // account (including anonymous) without waiting out the embargo — this must
    // never apply outside NODE_ENV=development, or the premium feature is dead.
    if (process.env.NODE_ENV !== 'development') {
      const threshold = new Date(now.getTime() + context.earlyAccessHours * 3600 * 1000);
      and.push({
        OR: [{ earlyAccessUntil: null }, { earlyAccessUntil: { lte: threshold } }],
      });
    }
  }

  if (query.q) {
    const term = query.q.trim();
    if (term.length > 0) {
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { company: { name: { contains: term, mode: 'insensitive' } } },
          { description: { contains: term, mode: 'insensitive' } },
          { skills: { hasSome: [term] } },
        ],
      });
    }
  }

  if (query.isRemote !== undefined) {
    and.push({ isRemote: query.isRemote });
  }
  if (query.jobTypes?.length) {
    and.push({ jobType: { in: query.jobTypes } });
  }
  if (query.workModels?.length) {
    and.push({ workModel: { in: query.workModels } });
  }
  if (query.experienceLevels?.length) {
    and.push({ experienceLevel: { in: query.experienceLevels } });
  }
  if (query.location) {
    const location = query.location.trim();
    and.push({
      OR: [
        { location: { contains: location, mode: 'insensitive' } },
        { city: { contains: location, mode: 'insensitive' } },
        { region: { contains: location, mode: 'insensitive' } },
        { country: { contains: location, mode: 'insensitive' } },
      ],
    });
  }
  if (query.country) {
    and.push({ country: { equals: query.country, mode: 'insensitive' } });
  }
  if (query.companyId) {
    and.push({ companyId: query.companyId });
  }
  if (query.companySlug) {
    and.push({ company: { slug: query.companySlug } });
  }
  if (query.sourceSlug) {
    and.push({ source: { slug: query.sourceSlug } });
  }
  if (query.skills?.length) {
    and.push({ skills: { hasSome: query.skills } });
  }
  if (query.visaSponsorship !== undefined) {
    and.push({ visaSponsorship: query.visaSponsorship });
  }
  if (query.postedWithinDays) {
    and.push({
      postedAt: { gte: new Date(now.getTime() - query.postedWithinDays * 24 * 3600 * 1000) },
    });
  }

  const salaryFilter = buildSalaryFilter(query.salaryMin, query.salaryMax);
  if (salaryFilter) {
    and.push(salaryFilter);
  }

  return and.length > 0 ? { AND: and } : {};
}

/**
 * Salary filters compare against annualized figures. Because the stored value's
 * period varies, each period gets its own bounded clause (e.g. a 100k yearly
 * floor becomes ~48/hour for hourly postings).
 */
function buildSalaryFilter(
  salaryMin?: number,
  salaryMax?: number,
): Prisma.JobWhereInput | null {
  if (!salaryMin && !salaryMax) {
    return null;
  }

  const periodClauses: Prisma.JobWhereInput[] = (
    Object.keys(ANNUALIZATION) as SalaryPeriod[]
  ).map((period) => {
    const divisor = ANNUALIZATION[period];
    const clause: Prisma.JobWhereInput = { salaryPeriod: period };

    if (salaryMin) {
      // Keep a job when either bound clears the requested floor.
      clause.OR = [
        { salaryMax: { gte: Math.round(salaryMin / divisor) } },
        { salaryMin: { gte: Math.round(salaryMin / divisor) } },
      ];
    }
    if (salaryMax) {
      clause.salaryMin = { lte: Math.round(salaryMax / divisor) };
    }
    return clause;
  });

  return { OR: periodClauses };
}

export function buildJobOrderBy(
  sortBy: JobSortBy = JobSortBy.NEWEST,
): Prisma.JobOrderByWithRelationInput[] {
  switch (sortBy) {
    case JobSortBy.OLDEST:
      return [{ postedAt: 'asc' }, { id: 'asc' }];
    case JobSortBy.SALARY_DESC:
      return [{ salaryMax: 'desc' }, { postedAt: 'desc' }];
    case JobSortBy.SALARY_ASC:
      return [{ salaryMin: 'asc' }, { postedAt: 'desc' }];
    case JobSortBy.RELEVANCE:
      // Without a ranked full-text index, "relevance" degrades to freshness +
      // engagement, which is a reasonable proxy and keeps the query index-backed.
      return [{ viewCount: 'desc' }, { postedAt: 'desc' }];
    case JobSortBy.NEWEST:
    default:
      return [{ postedAt: 'desc' }, { id: 'desc' }];
  }
}

/** Cursor pagination is only well-defined for the time-ordered sorts. */
export function supportsCursor(sortBy: JobSortBy = JobSortBy.NEWEST): boolean {
  return sortBy === JobSortBy.NEWEST || sortBy === JobSortBy.OLDEST;
}

export function buildCursorFilter(
  cursor: string,
  sortBy: JobSortBy = JobSortBy.NEWEST,
): Prisma.JobWhereInput {
  const { value, id } = decodeCursor(cursor);
  const boundary = new Date(value);
  const isDescending = sortBy !== JobSortBy.OLDEST;

  return isDescending
    ? { OR: [{ postedAt: { lt: boundary } }, { postedAt: boundary, id: { lt: id } }] }
    : { OR: [{ postedAt: { gt: boundary } }, { postedAt: boundary, id: { gt: id } }] };
}

export function buildNextCursor(
  lastRow: { id: string; postedAt: Date | null; createdAt: Date } | undefined,
): string | null {
  if (!lastRow) {
    return null;
  }
  return encodeCursor({
    value: (lastRow.postedAt ?? lastRow.createdAt).toISOString(),
    id: lastRow.id,
  });
}
