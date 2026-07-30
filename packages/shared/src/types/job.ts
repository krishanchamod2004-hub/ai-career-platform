import {
  ExperienceLevel,
  JobSourceType,
  JobStatus,
  JobType,
  SalaryPeriod,
  WorkLocationType,
} from '../enums';

/** Public company shape. Premium-only insight fields are stripped for free plans. */
export interface Company {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  industry: string | null;
  companySize: string | null;
  headquarters: string | null;
  linkedinUrl: string | null;
  foundedYear: number | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySummary {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  /** Real domain when known — lets the client derive a logo fallback without guessing. */
  websiteUrl: string | null;
  industry: string | null;
}

export interface CompanyWithStats extends Company {
  openJobCount: number;
  /** Present only when the caller's plan includes COMPANY_INSIGHTS. */
  insights?: CompanyInsights;
}

export interface CompanyInsights {
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  remoteJobShare: number;
  jobsPostedLast30Days: number;
  topSkills: string[];
  hiringVelocity: number;
}

export interface JobSourceSummary {
  id: string;
  slug: string;
  name: string;
  type: JobSourceType;
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  description: string;
  descriptionHtml: string | null;
  company: CompanySummary | null;
  source: JobSourceSummary | null;
  externalUrl: string | null;
  applyUrl: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  isRemote: boolean;
  workModel: WorkLocationType | null;
  jobType: JobType | null;
  experienceLevel: ExperienceLevel | null;
  minYearsExperience: number | null;
  skills: string[];
  benefits: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
  salaryText: string | null;
  visaSponsorship: boolean | null;
  status: JobStatus;
  postedAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  /** True while the listing is exclusive to plans with EARLY_JOB_ACCESS. */
  isEarlyAccess: boolean;
  /** Populated for authenticated callers. */
  isSaved?: boolean;
  applicationId?: string | null;
}

export interface JobListItem
  extends Pick<
    Job,
    | 'id'
    | 'slug'
    | 'title'
    | 'company'
    | 'location'
    | 'isRemote'
    | 'workModel'
    | 'jobType'
    | 'experienceLevel'
    | 'skills'
    | 'salaryMin'
    | 'salaryMax'
    | 'salaryCurrency'
    | 'salaryPeriod'
    | 'postedAt'
    | 'createdAt'
    | 'isEarlyAccess'
    | 'isSaved'
  > {
  excerpt: string;
}

/** Query contract for GET /jobs — mirrored by the API's QueryJobsDto. */
export interface JobSearchQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  cursor?: string;
  sortBy?: string;
  isRemote?: boolean;
  jobTypes?: JobType[];
  workModels?: WorkLocationType[];
  experienceLevels?: ExperienceLevel[];
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  location?: string;
  country?: string;
  companyId?: string;
  companySlug?: string;
  sourceSlug?: string;
  skills?: string[];
  postedWithinDays?: number;
  visaSponsorship?: boolean;
  includeExpired?: boolean;
}

export interface JobFacets {
  total: number;
  remoteCount: number;
  withSalaryCount: number;
  byJobType: Record<string, number>;
  byExperienceLevel: Record<string, number>;
}

export interface SavedJob {
  id: string;
  userId: string;
  jobId: string;
  notes: string | null;
  createdAt: string;
  job: JobListItem;
}
