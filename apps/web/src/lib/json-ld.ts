import { JobType, SalaryPeriod, type Job } from '@ai-career/shared';
import { SITE_NAME, SITE_URL } from '@/lib/site-config';

/** Google Jobs' required schema.org employmentType enum. */
const EMPLOYMENT_TYPE: Record<JobType, string> = {
  [JobType.FULL_TIME]: 'FULL_TIME',
  [JobType.PART_TIME]: 'PART_TIME',
  [JobType.CONTRACT]: 'CONTRACTOR',
  [JobType.INTERNSHIP]: 'INTERN',
  [JobType.FREELANCE]: 'CONTRACTOR',
};

const SALARY_UNIT: Record<SalaryPeriod, string> = {
  [SalaryPeriod.HOURLY]: 'HOUR',
  [SalaryPeriod.DAILY]: 'DAY',
  [SalaryPeriod.WEEKLY]: 'WEEK',
  [SalaryPeriod.MONTHLY]: 'MONTH',
  [SalaryPeriod.YEARLY]: 'YEAR',
};

/**
 * Builds Google's `JobPosting` structured data for one job.
 * https://developers.google.com/search/docs/appearance/structured-data/job-posting
 *
 * Only fields backed by real, normalized pipeline data are included — no
 * fabricated values. `hiringOrganization`/`jobLocation` are omitted entirely
 * when the underlying field is null, since a placeholder value would be worse
 * for a rich-result eligibility check than the field being absent.
 */
export function buildJobPostingJsonLd(job: Job): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.descriptionHtml ?? job.description,
    identifier: {
      '@type': 'PropertyValue',
      name: job.company?.name ?? SITE_NAME,
      value: job.id,
    },
    datePosted: job.postedAt ?? job.createdAt,
    ...(job.expiresAt ? { validThrough: job.expiresAt } : {}),
    employmentType: job.jobType ? EMPLOYMENT_TYPE[job.jobType] : undefined,
    hiringOrganization: job.company
      ? {
          '@type': 'Organization',
          name: job.company.name,
          ...(job.company.websiteUrl ? { sameAs: job.company.websiteUrl } : {}),
          ...(job.company.logoUrl ? { logo: job.company.logoUrl } : {}),
        }
      : undefined,
    directApply: false,
    url: `${SITE_URL}/jobs/${job.slug}`,
  };

  if (job.isRemote) {
    // Google Jobs requires applicantLocationRequirements for fully-remote posts.
    jsonLd.jobLocationType = 'TELECOMMUTE';
    jsonLd.applicantLocationRequirements = {
      '@type': 'Country',
      name: job.country ?? 'Worldwide',
    };
  }
  if (!job.isRemote && (job.city || job.location || job.country)) {
    jsonLd.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(job.city ? { addressLocality: job.city } : {}),
        ...(job.country ? { addressCountry: job.country } : {}),
        ...(!job.city && !job.country && job.location ? { addressRegion: job.location } : {}),
      },
    };
  }

  if (job.salaryMin || job.salaryMax) {
    jsonLd.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.salaryCurrency ?? 'USD',
      value: {
        '@type': 'QuantitativeValue',
        ...(job.salaryMin ? { minValue: job.salaryMin } : {}),
        ...(job.salaryMax ? { maxValue: job.salaryMax } : {}),
        unitText: job.salaryPeriod ? SALARY_UNIT[job.salaryPeriod] : 'YEAR',
      },
    };
  }

  // Strip undefined keys so the emitted JSON-LD has no "employmentType": undefined, etc.
  return Object.fromEntries(Object.entries(jsonLd).filter(([, value]) => value !== undefined));
}

/** `WebSite` + `SoftwareApplication` schema for the homepage. */
export function buildHomepageJsonLd(): Record<string, unknown>[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/jobs?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description:
        'AI-powered job search engine and career acceleration platform: aggregated remote tech ' +
        'jobs, ATS-friendly AI fit scoring, and automated application tracking.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ];
}
