import { JobSourceType } from '@ai-career/shared';
import {
  GlassdoorAdapter,
  IndeedAdapter,
  LinkedInAdapter,
  ZipRecruiterAdapter,
} from '../src/modules/scraper/adapters/jobspy.adapter';
import type {
  JobSpyClient,
  JobSpyRawJob,
  JobSpySearchRequest,
  JobSpySearchResponse,
} from '../src/modules/scraper/adapters/jobspy.client';
import type { AdapterContext, AdapterLogger } from '../src/modules/scraper/adapters/job-source-adapter.interface';

function buildLogger(): AdapterLogger {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function buildContext(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    config: { searchTerms: ['software engineer'] },
    requestsPerMinute: 10,
    since: null,
    fullSync: false,
    logger: buildLogger(),
    ...overrides,
  };
}

function buildJob(overrides: Partial<JobSpyRawJob> = {}): JobSpyRawJob {
  return {
    site: 'indeed',
    sourceJobId: 'indeed:in-1',
    title: 'Software Engineer',
    companyName: 'Acme Corp',
    url: 'https://www.indeed.com/viewjob?jk=1',
    applyUrl: 'https://careers.acme.com/1',
    descriptionHtml: '<p>Build things</p>',
    locationText: 'New York, NY, US',
    isRemote: false,
    employmentType: 'fulltime',
    salaryText: '120,000 - 150,000 USD yearly',
    salaryMin: 120_000,
    salaryMax: 150_000,
    salaryCurrency: 'USD',
    postedAt: '2026-07-20T00:00:00',
    tags: ['Engineering'],
    ...overrides,
  };
}

function buildResponse(jobs: JobSpyRawJob[], overrides: Partial<JobSpySearchResponse> = {}) {
  return {
    jobs,
    countsBySite: { indeed: jobs.length },
    total: jobs.length,
    elapsedMs: 1000,
    skipped: 0,
    warnings: [],
    ...overrides,
  } satisfies JobSpySearchResponse;
}

/** Minimal stub: records requests and replays queued responses. */
function buildClient(handler: (request: JobSpySearchRequest) => Promise<JobSpySearchResponse>) {
  const requests: JobSpySearchRequest[] = [];
  const client = {
    search: jest.fn(async (request: JobSpySearchRequest) => {
      requests.push(request);
      return handler(request);
    }),
    health: jest.fn(),
  } as unknown as JobSpyClient;
  return { client, requests };
}

describe('JobSpy adapters', () => {
  describe('source type registration', () => {
    it('maps each adapter to its board and JobSourceType', () => {
      const { client } = buildClient(async () => buildResponse([]));

      expect(new LinkedInAdapter(client).type).toBe(JobSourceType.LINKEDIN);
      expect(new IndeedAdapter(client).type).toBe(JobSourceType.INDEED);
      expect(new GlassdoorAdapter(client).type).toBe(JobSourceType.GLASSDOOR);
      expect(new ZipRecruiterAdapter(client).type).toBe(JobSourceType.ZIPRECRUITER);
    });

    it('sends ZipRecruiter as zip_recruiter, not ziprecruiter', async () => {
      const { client, requests } = buildClient(async () => buildResponse([]));
      await new ZipRecruiterAdapter(client).fetchJobs(buildContext());
      expect(requests[0].sites).toEqual(['zip_recruiter']);
    });
  });

  describe('fetchJobs', () => {
    it('maps a sidecar posting onto the RawJob contract', async () => {
      const { client } = buildClient(async () => buildResponse([buildJob()]));
      const jobs = await new IndeedAdapter(client).fetchJobs(buildContext());

      expect(jobs).toHaveLength(1);
      const [job] = jobs;
      expect(job.sourceJobId).toBe('indeed:in-1');
      expect(job.title).toBe('Software Engineer');
      expect(job.companyName).toBe('Acme Corp');
      expect(job.descriptionHtml).toBe('<p>Build things</p>');
      expect(job.salaryMin).toBe(120_000);
      expect(job.salaryCurrency).toBe('USD');
      expect(job.applyUrl).toBe('https://careers.acme.com/1');
      // The JSON string must become a real Date for the parser downstream.
      expect(job.postedAt).toBeInstanceOf(Date);
      expect(job.postedAt?.toISOString()).toBe(new Date('2026-07-20T00:00:00').toISOString());
      // `site` is attribution metadata only and must not leak into RawJob.
      expect(job as unknown as Record<string, unknown>).not.toHaveProperty('site');
    });

    it('coerces an unparseable postedAt to null instead of Invalid Date', async () => {
      const { client } = buildClient(async () => buildResponse([buildJob({ postedAt: 'nope' })]));
      const [job] = await new IndeedAdapter(client).fetchJobs(buildContext());
      expect(job.postedAt).toBeNull();
    });

    it('runs one search per configured term and de-duplicates overlapping results', async () => {
      const { client, requests } = buildClient(async (request) =>
        buildResponse(
          request.search_term === 'backend engineer'
            ? [buildJob(), buildJob({ sourceJobId: 'indeed:in-2' })]
            : [buildJob()],
        ),
      );

      const jobs = await new IndeedAdapter(client).fetchJobs(
        buildContext({ config: { searchTerms: ['software engineer', 'backend engineer'] } }),
      );

      expect(requests.map((request) => request.search_term)).toEqual([
        'software engineer',
        'backend engineer',
      ]);
      // in-1 was returned by both terms but must appear once.
      expect(jobs.map((job) => job.sourceJobId)).toEqual(['indeed:in-1', 'indeed:in-2']);
    });

    it('accepts a single searchTerm string and ignores blank/duplicate terms', async () => {
      const { client, requests } = buildClient(async () => buildResponse([]));
      await new IndeedAdapter(client).fetchJobs(
        buildContext({ config: { searchTerms: ['dev', '  ', 'dev'] } }),
      );
      expect(requests).toHaveLength(1);

      const single = buildClient(async () => buildResponse([]));
      await new IndeedAdapter(single.client).fetchJobs(
        buildContext({ config: { searchTerm: 'qa engineer' } }),
      );
      expect(single.requests[0].search_term).toBe('qa engineer');
    });

    it('returns empty and warns when no search terms are configured', async () => {
      const { client } = buildClient(async () => buildResponse([buildJob()]));
      const logger = buildLogger();
      const jobs = await new IndeedAdapter(client).fetchJobs(
        buildContext({ config: {}, logger }),
      );

      expect(jobs).toEqual([]);
      expect(client.search).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('forwards board filters from JobSource.config', async () => {
      const { client, requests } = buildClient(async () => buildResponse([]));
      await new IndeedAdapter(client).fetchJobs(
        buildContext({
          config: {
            searchTerms: ['dev'],
            location: 'Austin, TX',
            resultsWanted: 40,
            distance: 25,
            countryIndeed: 'USA',
            offset: 10,
          },
        }),
      );

      expect(requests[0]).toMatchObject({
        location: 'Austin, TX',
        results_wanted: 40,
        distance: 25,
        country_indeed: 'USA',
        offset: 10,
      });
    });
  });

  describe('incremental watermark', () => {
    it('derives hours_old from `since`', async () => {
      const { client, requests } = buildClient(async () => buildResponse([]));
      const since = new Date(Date.now() - 12 * 3_600_000);

      await new IndeedAdapter(client).fetchJobs(buildContext({ since }));

      expect(requests[0].hours_old).toBeGreaterThanOrEqual(12);
      expect(requests[0].hours_old).toBeLessThanOrEqual(13);
    });

    it('omits hours_old on a full sync', async () => {
      const { client, requests } = buildClient(async () => buildResponse([]));
      await new IndeedAdapter(client).fetchJobs(
        buildContext({ since: new Date(Date.now() - 3_600_000), fullSync: true }),
      );
      expect(requests[0].hours_old).toBeUndefined();
    });

    it('drops hours_old when a job_type/is_remote filter is set', async () => {
      // Indeed/Glassdoor/LinkedIn accept only one of these per search; sending
      // both makes the sidecar reject the request with a 422.
      const { client, requests } = buildClient(async () => buildResponse([]));
      await new IndeedAdapter(client).fetchJobs(
        buildContext({
          config: { searchTerms: ['dev'], isRemote: true },
          since: new Date(Date.now() - 12 * 3_600_000),
        }),
      );

      expect(requests[0].is_remote).toBe(true);
      expect(requests[0].hours_old).toBeUndefined();
    });

    it('filters postings older than `since` that the board rounded in', async () => {
      // Boards round hours_old up to whole days, so stale rows still arrive.
      const since = new Date('2026-07-20T00:00:00Z');
      const { client } = buildClient(async () =>
        buildResponse([
          buildJob({ sourceJobId: 'indeed:new', postedAt: '2026-07-21T00:00:00Z' }),
          buildJob({ sourceJobId: 'indeed:old', postedAt: '2026-07-18T00:00:00Z' }),
          buildJob({ sourceJobId: 'indeed:undated', postedAt: null }),
        ]),
      );

      const jobs = await new IndeedAdapter(client).fetchJobs(buildContext({ since }));

      // Undated postings are kept: the cleaner decides, not the adapter.
      expect(jobs.map((job) => job.sourceJobId)).toEqual(['indeed:new', 'indeed:undated']);
    });
  });

  describe('failure handling', () => {
    it('keeps results from terms that succeeded when one term fails', async () => {
      const { client } = buildClient(async (request) => {
        if (request.search_term === 'blocked') {
          throw new Error('JobSpy scrape failed upstream (likely rate limit or IP block)');
        }
        return buildResponse([buildJob()]);
      });
      const logger = buildLogger();

      const jobs = await new IndeedAdapter(client).fetchJobs(
        buildContext({ config: { searchTerms: ['blocked', 'software engineer'] }, logger }),
      );

      expect(jobs).toHaveLength(1);
      expect(logger.error).toHaveBeenCalled();
    });

    it('throws when every search fails so the run is recorded FAILED and retried', async () => {
      const { client } = buildClient(async () => {
        throw new Error('JobSpy sidecar unreachable at http://127.0.0.1:8000');
      });

      await expect(
        new IndeedAdapter(client).fetchJobs(
          buildContext({ config: { searchTerms: ['a', 'b'] } }),
        ),
      ).rejects.toThrow(/All 2 JobSpy search\(es\) failed for INDEED/);
    });

    it('surfaces sidecar warnings through the run logger', async () => {
      const { client } = buildClient(async () =>
        buildResponse([], { warnings: ['no results from: indeed (possible rate limit or IP block)'] }),
      );
      const logger = buildLogger();

      await new IndeedAdapter(client).fetchJobs(buildContext({ logger }));

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('possible rate limit or IP block'),
      );
    });
  });
});
