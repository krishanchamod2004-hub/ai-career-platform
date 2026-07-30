import { JobSourceType, LogLevel, ScraperRunStatus, ScraperTrigger } from '../enums';

export interface JobSource {
  id: string;
  slug: string;
  name: string;
  type: JobSourceType;
  /** Adapter-specific configuration, e.g. `{ "boards": ["stripe", "figma"] }`. */
  config: Record<string, unknown>;
  isEnabled: boolean;
  cronExpression: string;
  requestsPerMinute: number;
  priority: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScraperRun {
  id: string;
  sourceId: string;
  sourceSlug?: string;
  status: ScraperRunStatus;
  trigger: ScraperTrigger;
  queueJobId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  jobsFound: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsSkipped: number;
  jobsFailed: number;
  errorMessage: string | null;
  attempt: number;
}

export interface ScraperLog {
  id: string;
  runId: string | null;
  sourceId: string | null;
  level: LogLevel;
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

export interface SourceHealth {
  source: JobSource;
  lastRun: ScraperRun | null;
  successRate24h: number;
  jobsIngested24h: number;
  isHealthy: boolean;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
}

/** Platform-wide analytics surface (admin) — see AnalyticsService.getOverview. */
export interface AnalyticsOverview {
  totalJobs: number;
  activeJobs: number;
  newJobsToday: number;
  newJobs7Days: number;
  totalCompanies: number;
  totalUsers: number;
  activeUsers7Days: number;
  activeUsers30Days: number;
  totalSavedJobs: number;
  totalApplications: number;
  applicationsToday: number;
  totalAlerts: number;
  jobsBySource: Array<{ source: string; count: number }>;
}

export interface DailyStatPoint {
  date: string;
  newJobs: number;
  activeUsers: number;
  savedJobs: number;
  applications: number;
  scraperRuns: number;
  scraperFailures: number;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  isEmailVerified: boolean;
  savedJobCount: number;
  applicationCount: number;
  createdAt: string;
  lastActiveAt: string | null;
}
