import type {
  ExperienceLevel,
  JobType,
  SalaryPeriod,
  ScraperTrigger,
  WorkLocationType,
} from '@ai-career/shared';

/** Output of the parser stage: normalized, but not yet validated or hashed. */
export interface ParsedJob {
  sourceJobId: string;
  title: string;
  companyName: string;
  companySlug: string;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  description: string;
  descriptionHtml: string | null;
  location: string | null;
  city: string | null;
  region: string | null;
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
  postedAt: Date | null;
  url: string;
  applyUrl: string | null;
  tags: string[];
}

/** Output of the cleaner + dedupe stages: safe to persist. */
export interface CleanJob extends ParsedJob {
  slug: string;
  /** Cross-source fingerprint (company + title + location). */
  dedupeKey: string;
  /** Hash of the meaningful content, used to decide update-vs-skip. */
  contentHash: string;
}

export interface IngestionResult {
  created: string[];
  updated: string[];
  skipped: number;
  failed: number;
}

export interface ScrapeRunResult {
  runId: string;
  sourceSlug: string;
  jobsFound: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsSkipped: number;
  jobsFailed: number;
  durationMs: number;
}

export interface RunSourceOptions {
  trigger: ScraperTrigger;
  queueJobId?: string | null;
  attempt?: number;
  fullSync?: boolean;
}
