import { ExperienceLevel, JobType, SalaryPeriod, WorkLocationType } from '@ai-career/shared';
import { DedupeService } from '../src/modules/scraper/services/dedupe.service';
import { DataCleanerService } from '../src/modules/scraper/services/data-cleaner.service';
import type { ParsedJob } from '../src/modules/scraper/scraper.types';

function buildParsedJob(overrides: Partial<ParsedJob> = {}): ParsedJob {
  return {
    sourceJobId: 'greenhouse:acme:1',
    title: 'Senior Backend Engineer',
    companyName: 'Acme Inc.',
    companySlug: 'acme',
    companyWebsite: null,
    companyLogoUrl: null,
    description:
      'We are hiring a backend engineer to build resilient APIs with Node.js and PostgreSQL across our platform.',
    descriptionHtml: null,
    location: 'Berlin, Germany',
    city: 'Berlin',
    region: null,
    country: 'Germany',
    isRemote: false,
    workModel: WorkLocationType.ONSITE,
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.SENIOR,
    minYearsExperience: 5,
    skills: ['Node.js', 'PostgreSQL'],
    benefits: ['Health insurance'],
    salaryMin: 90_000,
    salaryMax: 120_000,
    salaryCurrency: 'EUR',
    salaryPeriod: SalaryPeriod.YEARLY,
    salaryText: null,
    visaSponsorship: null,
    postedAt: new Date('2026-07-01T00:00:00.000Z'),
    url: 'https://boards.greenhouse.io/acme/jobs/1',
    applyUrl: null,
    tags: [],
    ...overrides,
  };
}

describe('DedupeService', () => {
  const service = new DedupeService();

  it('produces the same dedupe key for the same role from different sources', () => {
    const fromGreenhouse = buildParsedJob({ sourceJobId: 'greenhouse:acme:1' });
    const fromRemoteOk = buildParsedJob({
      sourceJobId: 'remoteok:998',
      // Cosmetic differences that should not create a second row.
      title: 'Senior Backend Engineer (Full-time)',
      companyName: 'Acme, Inc',
    });

    expect(service.computeDedupeKey(fromRemoteOk)).toBe(service.computeDedupeKey(fromGreenhouse));
  });

  it('treats a different city as a different opening', () => {
    const berlin = buildParsedJob();
    const munich = buildParsedJob({ city: 'Munich' });
    expect(service.computeDedupeKey(munich)).not.toBe(service.computeDedupeKey(berlin));
  });

  it('collapses remote postings regardless of stated location', () => {
    const remoteA = buildParsedJob({ isRemote: true, city: 'Berlin' });
    const remoteB = buildParsedJob({ isRemote: true, city: 'Lisbon' });
    expect(service.computeDedupeKey(remoteA)).toBe(service.computeDedupeKey(remoteB));
  });

  it('changes the content hash when user-visible content changes', () => {
    const original = buildParsedJob();
    const repriced = buildParsedJob({ salaryMax: 140_000 });
    expect(service.computeContentHash(repriced)).not.toBe(service.computeContentHash(original));
  });

  it('keeps the content hash stable for identical content', () => {
    expect(service.computeContentHash(buildParsedJob())).toBe(
      service.computeContentHash(buildParsedJob()),
    );
  });

  it('removes in-batch duplicates and attaches slug + hashes', () => {
    const { jobs, duplicatesInBatch } = service.prepare([
      buildParsedJob(),
      buildParsedJob({ sourceJobId: 'lever:acme:9' }),
      buildParsedJob({ title: 'Frontend Engineer' }),
    ]);

    expect(duplicatesInBatch).toBe(1);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].slug).toMatch(/^senior-backend-engineer-at-acme-inc-[0-9a-f]{8}$/);
    expect(jobs[0].dedupeKey).toHaveLength(40);
    expect(jobs[0].contentHash).toHaveLength(64);
  });
});

describe('DataCleanerService', () => {
  const cleaner = new DataCleanerService();

  it('keeps a well-formed posting', () => {
    const { jobs, rejected } = cleaner.clean([buildParsedJob()]);
    expect(rejected).toHaveLength(0);
    expect(jobs).toHaveLength(1);
  });

  it('rejects postings without a title, company, or url', () => {
    const { jobs, rejected } = cleaner.clean([
      buildParsedJob({ title: '   ' }),
      buildParsedJob({ companyName: '', companySlug: '' }),
      buildParsedJob({ url: 'not-a-url' }),
    ]);

    expect(jobs).toHaveLength(0);
    expect(rejected.map((entry) => entry.reason)).toEqual([
      'missing title',
      'missing company',
      'missing or invalid url',
    ]);
  });

  it('rejects stub descriptions', () => {
    const { rejected } = cleaner.clean([buildParsedJob({ description: 'Apply here' })]);
    expect(rejected[0].reason).toBe('description too short');
  });

  it('drops implausible salaries instead of storing them', () => {
    const { jobs } = cleaner.clean([
      buildParsedJob({ salaryMin: 12, salaryMax: 40, salaryPeriod: SalaryPeriod.YEARLY }),
    ]);
    expect(jobs[0].salaryMin).toBeNull();
    expect(jobs[0].salaryMax).toBeNull();
    expect(jobs[0].salaryPeriod).toBeNull();
  });

  it('clamps future posted dates to now', () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const { jobs } = cleaner.clean([buildParsedJob({ postedAt: future })]);
    expect(jobs[0].postedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('rejects postings older than the age cutoff', () => {
    const { rejected } = cleaner.clean([
      buildParsedJob({ postedAt: new Date(Date.now() - 400 * 24 * 3600 * 1000) }),
    ]);
    expect(rejected[0].reason).toContain('older than');
  });

  it('normalizes whitespace and de-duplicates arrays', () => {
    const { jobs } = cleaner.clean([
      buildParsedJob({
        title: '  Senior   Backend    Engineer ',
        skills: ['Node.js', 'Node.js', ' PostgreSQL '],
      }),
    ]);
    expect(jobs[0].title).toBe('Senior Backend Engineer');
    expect(jobs[0].skills).toEqual(['Node.js', 'PostgreSQL']);
  });
});
