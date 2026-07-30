import { Prisma } from '@prisma/client';
import type {
  ExperienceLevel,
  Job,
  JobListItem,
  JobSourceType,
  JobStatus,
  JobType,
  SalaryPeriod,
  WorkLocationType,
} from '@ai-career/shared';
import { truncate } from '../scraper/parsers/text.util';

/** Columns needed for list cards — deliberately excludes the full description. */
export const jobListSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  location: true,
  isRemote: true,
  workModel: true,
  jobType: true,
  experienceLevel: true,
  skills: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  postedAt: true,
  createdAt: true,
  earlyAccessUntil: true,
  company: {
    select: { id: true, slug: true, name: true, logoUrl: true, websiteUrl: true, industry: true },
  },
} satisfies Prisma.JobSelect;

export const jobDetailInclude = {
  company: true,
  source: { select: { id: true, slug: true, name: true, type: true } },
} satisfies Prisma.JobInclude;

export type JobListRow = Prisma.JobGetPayload<{ select: typeof jobListSelect }>;
export type JobDetailRow = Prisma.JobGetPayload<{ include: typeof jobDetailInclude }>;

export function isEarlyAccess(earlyAccessUntil: Date | null, now = new Date()): boolean {
  return earlyAccessUntil !== null && earlyAccessUntil.getTime() > now.getTime();
}

export function toJobListItem(
  row: JobListRow,
  options: { savedJobIds?: Set<string>; now?: Date } = {},
): JobListItem {
  const now = options.now ?? new Date();
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    company: row.company
      ? {
          id: row.company.id,
          slug: row.company.slug,
          name: row.company.name,
          logoUrl: row.company.logoUrl,
          websiteUrl: row.company.websiteUrl,
          industry: row.company.industry,
        }
      : null,
    location: row.location,
    isRemote: row.isRemote,
    workModel: row.workModel as WorkLocationType | null,
    jobType: row.jobType as JobType | null,
    experienceLevel: row.experienceLevel as ExperienceLevel | null,
    skills: row.skills,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod as SalaryPeriod | null,
    postedAt: row.postedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    isEarlyAccess: isEarlyAccess(row.earlyAccessUntil, now),
    isSaved: options.savedJobIds ? options.savedJobIds.has(row.id) : undefined,
    excerpt: truncate(row.description.replace(/\s+/g, ' ').trim(), 240),
  };
}

export function toJobDetail(
  row: JobDetailRow,
  options: { isSaved?: boolean; applicationId?: string | null; now?: Date } = {},
): Job {
  const now = options.now ?? new Date();
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    descriptionHtml: row.descriptionHtml,
    company: row.company
      ? {
          id: row.company.id,
          slug: row.company.slug,
          name: row.company.name,
          logoUrl: row.company.logoUrl,
          websiteUrl: row.company.websiteUrl,
          industry: row.company.industry,
        }
      : null,
    source: row.source
      ? {
          id: row.source.id,
          slug: row.source.slug,
          name: row.source.name,
          type: row.source.type as JobSourceType,
        }
      : null,
    externalUrl: row.externalUrl,
    applyUrl: row.applyUrl,
    location: row.location,
    city: row.city,
    country: row.country,
    isRemote: row.isRemote,
    workModel: row.workModel as WorkLocationType | null,
    jobType: row.jobType as JobType | null,
    experienceLevel: row.experienceLevel as ExperienceLevel | null,
    minYearsExperience: row.minYearsExperience,
    skills: row.skills,
    benefits: row.benefits,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod as SalaryPeriod | null,
    salaryText: row.salaryText,
    visaSponsorship: row.visaSponsorship,
    status: row.status as JobStatus,
    postedAt: row.postedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isEarlyAccess: isEarlyAccess(row.earlyAccessUntil, now),
    isSaved: options.isSaved,
    applicationId: options.applicationId ?? null,
  };
}
