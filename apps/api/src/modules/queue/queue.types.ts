import type { ScraperTrigger } from '@ai-career/shared';

/**
 * Payload contracts for every queued job. Producers and processors both import
 * these so a rename cannot silently break a worker.
 */

export interface ScrapeSourceJobData {
  sourceId: string;
  sourceSlug: string;
  trigger: ScraperTrigger;
  /** Ignore the incremental watermark and re-ingest everything the source offers. */
  fullSync?: boolean;
}

export interface MatchNewJobsJobData {
  /** Jobs created by a single scrape run — matched against active alerts. */
  jobIds: string[];
  runId?: string;
}

export interface SendAlertDigestJobData {
  frequency: 'DAILY' | 'WEEKLY';
}

export interface SendNotificationJobData {
  notificationId: string;
}

export interface MaintenanceJobData {
  /** ISO date the task should treat as "today" (defaults to now). */
  asOf?: string;
}
