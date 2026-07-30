import { ExperienceLevel, JobSortBy, JobStatus, JobType } from '@ai-career/shared';
import {
  buildCursorFilter,
  buildJobOrderBy,
  buildJobWhere,
  buildNextCursor,
  supportsCursor,
} from '../src/modules/jobs/jobs.query-builder';
import { encodeCursor } from '../src/common/pagination/pagination.util';
import type { QueryJobsDto } from '../src/modules/jobs/dto/query-jobs.dto';

const NOW = new Date('2026-07-25T12:00:00.000Z');

function query(overrides: Partial<QueryJobsDto> = {}): QueryJobsDto {
  return { page: 1, pageSize: 20, ...overrides } as QueryJobsDto;
}

/** Flattens the nested AND array so assertions can look for specific clauses. */
function clauses(where: ReturnType<typeof buildJobWhere>): Record<string, unknown>[] {
  return ((where.AND ?? []) as Record<string, unknown>[]) ?? [];
}

describe('buildJobWhere visibility', () => {
  it('restricts anonymous callers to active, non-embargoed jobs', () => {
    const where = buildJobWhere(query(), { earlyAccessHours: 0, now: NOW });
    const list = clauses(where);

    expect(list).toContainEqual({ status: JobStatus.ACTIVE });
    expect(list).toContainEqual({
      OR: [{ earlyAccessUntil: null }, { earlyAccessUntil: { lte: NOW } }],
    });
  });

  it('widens the early-access window for entitled plans', () => {
    const where = buildJobWhere(query(), { earlyAccessHours: 12, now: NOW });
    const visibility = clauses(where).find((clause) => 'OR' in clause) as {
      OR: Array<{ earlyAccessUntil?: { lte?: Date } }>;
    };

    expect(visibility.OR[1].earlyAccessUntil?.lte).toEqual(
      new Date(NOW.getTime() + 12 * 3600 * 1000),
    );
  });

  it('skips visibility filtering for admin/system callers', () => {
    const where = buildJobWhere(query(), {
      earlyAccessHours: 0,
      now: NOW,
      bypassVisibility: true,
    });
    expect(clauses(where)).not.toContainEqual({ status: JobStatus.ACTIVE });
  });

  it('includes expired listings on request', () => {
    const where = buildJobWhere(query({ includeExpired: true }), {
      earlyAccessHours: 0,
      now: NOW,
    });
    expect(clauses(where)).not.toContainEqual({ status: JobStatus.ACTIVE });
  });
});

describe('buildJobWhere filters', () => {
  it('searches title, company, description, and skills', () => {
    const where = buildJobWhere(query({ q: 'react' }), { earlyAccessHours: 0, now: NOW });
    const search = clauses(where).find(
      (clause) => Array.isArray((clause as { OR?: unknown[] }).OR) &&
        JSON.stringify(clause).includes('title'),
    );
    expect(JSON.stringify(search)).toContain('"contains":"react"');
    expect(JSON.stringify(search)).toContain('company');
    expect(JSON.stringify(search)).toContain('skills');
  });

  it('applies scalar and array filters', () => {
    const where = buildJobWhere(
      query({
        isRemote: true,
        jobTypes: [JobType.FULL_TIME, JobType.CONTRACT],
        experienceLevels: [ExperienceLevel.SENIOR],
        skills: ['TypeScript'],
        visaSponsorship: true,
        companyId: 'company-1',
      }),
      { earlyAccessHours: 0, now: NOW },
    );
    const list = clauses(where);

    expect(list).toContainEqual({ isRemote: true });
    expect(list).toContainEqual({ jobType: { in: [JobType.FULL_TIME, JobType.CONTRACT] } });
    expect(list).toContainEqual({ experienceLevel: { in: [ExperienceLevel.SENIOR] } });
    expect(list).toContainEqual({ skills: { hasSome: ['TypeScript'] } });
    expect(list).toContainEqual({ visaSponsorship: true });
    expect(list).toContainEqual({ companyId: 'company-1' });
  });

  it('converts postedWithinDays into a date boundary', () => {
    const where = buildJobWhere(query({ postedWithinDays: 7 }), {
      earlyAccessHours: 0,
      now: NOW,
    });
    expect(clauses(where)).toContainEqual({
      postedAt: { gte: new Date(NOW.getTime() - 7 * 24 * 3600 * 1000) },
    });
  });

  it('annualizes the salary floor per pay period', () => {
    const where = buildJobWhere(query({ salaryMin: 104_000 }), {
      earlyAccessHours: 0,
      now: NOW,
    });
    const salaryClause = clauses(where).find((clause) =>
      JSON.stringify(clause).includes('salaryPeriod'),
    ) as { OR: Array<{ salaryPeriod: string; OR?: Array<Record<string, { gte: number }>> }> };

    const hourly = salaryClause.OR.find((entry) => entry.salaryPeriod === 'HOURLY');
    const yearly = salaryClause.OR.find((entry) => entry.salaryPeriod === 'YEARLY');

    // 104,000 / 2080 working hours = 50 per hour.
    expect(hourly?.OR?.[0].salaryMax.gte).toBe(50);
    expect(yearly?.OR?.[0].salaryMax.gte).toBe(104_000);
  });

  it('produces an empty clause when nothing is filtered and visibility is bypassed', () => {
    expect(
      buildJobWhere(query(), { earlyAccessHours: 0, bypassVisibility: true }),
    ).toEqual({});
  });
});

describe('sorting and cursors', () => {
  it('orders by recency by default with a stable tie-breaker', () => {
    expect(buildJobOrderBy()).toEqual([{ postedAt: 'desc' }, { id: 'desc' }]);
  });

  it('supports salary sorting', () => {
    expect(buildJobOrderBy(JobSortBy.SALARY_DESC)).toEqual([
      { salaryMax: 'desc' },
      { postedAt: 'desc' },
    ]);
  });

  it('only allows cursor pagination on time-ordered sorts', () => {
    expect(supportsCursor(JobSortBy.NEWEST)).toBe(true);
    expect(supportsCursor(JobSortBy.OLDEST)).toBe(true);
    expect(supportsCursor(JobSortBy.SALARY_DESC)).toBe(false);
  });

  it('builds a keyset filter that cannot skip or repeat rows', () => {
    const cursor = encodeCursor({ value: NOW.toISOString(), id: 'job-5' });
    expect(buildCursorFilter(cursor, JobSortBy.NEWEST)).toEqual({
      OR: [{ postedAt: { lt: NOW } }, { postedAt: NOW, id: { lt: 'job-5' } }],
    });
    expect(buildCursorFilter(cursor, JobSortBy.OLDEST)).toEqual({
      OR: [{ postedAt: { gt: NOW } }, { postedAt: NOW, id: { gt: 'job-5' } }],
    });
  });

  it('round-trips the next cursor and falls back to createdAt', () => {
    const cursor = buildNextCursor({ id: 'job-9', postedAt: null, createdAt: NOW });
    expect(cursor).not.toBeNull();
    expect(buildCursorFilter(cursor as string)).toEqual({
      OR: [{ postedAt: { lt: NOW } }, { postedAt: NOW, id: { lt: 'job-9' } }],
    });
  });

  it('returns null when there is no last row', () => {
    expect(buildNextCursor(undefined)).toBeNull();
  });
});
