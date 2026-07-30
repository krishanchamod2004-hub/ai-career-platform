import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';

/** Mirrors the request model in services/jobspy/app/schemas.py. */
export interface JobSpySearchRequest {
  search_term: string;
  location?: string | null;
  sites: string[];
  results_wanted?: number;
  distance?: number;
  job_type?: string;
  is_remote?: boolean;
  hours_old?: number;
  offset?: number;
  country_indeed?: string;
}

/**
 * One posting from the sidecar: the `RawJob` fields plus `site`, with `postedAt`
 * as an ISO string because it crossed a JSON boundary.
 */
export interface JobSpyRawJob {
  site: string;
  sourceJobId: string;
  title: string;
  companyName: string;
  url: string;
  companyWebsite?: string | null;
  companyLogoUrl?: string | null;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  locationText?: string | null;
  isRemote?: boolean | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  department?: string | null;
  salaryText?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  postedAt?: string | null;
  applyUrl?: string | null;
  tags?: string[];
}

export interface JobSpySearchResponse {
  jobs: JobSpyRawJob[];
  countsBySite: Record<string, number>;
  total: number;
  elapsedMs: number;
  skipped: number;
  warnings: string[];
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';
/** Slightly above the sidecar's own 180s ceiling so its 504 wins the race. */
const DEFAULT_TIMEOUT_MS = 200_000;

/**
 * Transport to the Python JobSpy sidecar (services/jobspy).
 *
 * The sidecar owns scraping only — it holds no database credentials — so this
 * client returns postings and nothing else. Persistence stays in
 * JobIngestionService where dedupeKey/contentHash/slug are derived.
 */
@Injectable()
export class JobSpyClient {
  private readonly logger = new Logger(JobSpyClient.name);
  private readonly client: AxiosInstance;
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('JOBSPY_SERVICE_URL', DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.token = config.get<string>('JOBSPY_API_TOKEN', '');
    const timeout = Number(config.get('JOBSPY_TIMEOUT_MS', DEFAULT_TIMEOUT_MS));

    if (!this.token) {
      this.logger.warn(
        'JOBSPY_API_TOKEN is not set — requests will be rejected unless the sidecar runs with JOBSPY_ALLOW_INSECURE=true',
      );
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { 'X-JobSpy-Token': this.token } : {}),
      },
    });
  }

  async search(request: JobSpySearchRequest): Promise<JobSpySearchResponse> {
    try {
      const response = await this.client.post<JobSpySearchResponse>('/search-jobs', request);
      return response.data;
    } catch (error) {
      throw this.toDomainError(error as AxiosError, '/search-jobs');
    }
  }

  async health(): Promise<{ status: string; proxiesConfigured: number; sites: string[] }> {
    try {
      const response = await this.client.get<{
        status: string;
        proxiesConfigured: number;
        sites: string[];
      }>('/health', { timeout: 5_000 });
      return response.data;
    } catch (error) {
      throw this.toDomainError(error as AxiosError, '/health');
    }
  }

  /**
   * Translates transport failures into messages an operator can act on — these
   * strings land in ScraperRun.errorMessage and the admin dashboard.
   */
  private toDomainError(error: AxiosError, path: string): Error {
    const status = error.response?.status;
    const detail =
      (error.response?.data as { detail?: string } | undefined)?.detail ?? error.message;

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new ServiceUnavailableException(
        `JobSpy sidecar unreachable at ${this.baseUrl} — start it with: uvicorn app.main:app (services/jobspy)`,
      );
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new Error(`JobSpy sidecar timed out on ${path} after ${this.client.defaults.timeout}ms`);
    }
    if (status === 401) {
      return new Error('JobSpy sidecar rejected the token (check JOBSPY_API_TOKEN on both sides)');
    }
    if (status === 422) {
      return new Error(`JobSpy sidecar rejected the request: ${detail}`);
    }
    if (status === 502) {
      // The sidecar maps upstream scraper failures to 502; almost always a block.
      return new Error(
        `JobSpy scrape failed upstream (likely rate limit or IP block): ${detail}`,
      );
    }
    if (status === 504) {
      return new Error(`JobSpy search exceeded the sidecar timeout: ${detail}`);
    }
    return new Error(`JobSpy sidecar error on ${path}: ${status ?? error.code ?? ''} ${detail}`.trim());
  }
}
