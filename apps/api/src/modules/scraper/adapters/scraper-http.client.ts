import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 3;
const USER_AGENT =
  'AICareerPlatformBot/1.0 (+https://github.com/ai-career-platform; job aggregation)';

export interface FetchOptions {
  /** Requests per minute allowed for the owning source; throttles sequential calls. */
  requestsPerMinute?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Shared outbound HTTP client for adapters.
 *
 * Adds the behaviour every third-party integration needs: identifying User-Agent,
 * bounded timeouts, exponential backoff on 429/5xx (honouring Retry-After), and a
 * per-source rate limiter so a burst of boards cannot get the platform blocked.
 */
@Injectable()
export class ScraperHttpClient {
  private readonly logger = new Logger(ScraperHttpClient.name);
  private readonly client: AxiosInstance;
  private lastRequestAt = 0;

  constructor() {
    // Non-2xx responses reject, which the retry loop below classifies.
    this.client = axios.create({
      timeout: DEFAULT_TIMEOUT_MS,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
  }

  async getJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      await this.throttle(options.requestsPerMinute);
      try {
        const response = await this.client.get<T>(url, {
          headers: options.headers,
          timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const isRetryable = !status || status === 429 || status >= 500;

        if (!isRetryable || attempt === maxRetries) {
          break;
        }

        const retryAfterHeader = axiosError.response?.headers?.['retry-after'];
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
        const backoffMs = retryAfterMs || Math.min(30_000, 2 ** attempt * 500);
        this.logger.warn(
          `GET ${url} failed (${status ?? axiosError.code}); retry ${attempt}/${maxRetries - 1} in ${backoffMs}ms`,
        );
        await this.sleep(backoffMs);
      }
    }

    const axiosError = lastError as AxiosError;
    throw new Error(
      `Request failed for ${url}: ${axiosError?.response?.status ?? ''} ${axiosError?.message ?? 'unknown error'}`.trim(),
    );
  }

  private async throttle(requestsPerMinute?: number): Promise<void> {
    if (!requestsPerMinute || requestsPerMinute <= 0) {
      return;
    }
    const minIntervalMs = Math.ceil(60_000 / requestsPerMinute);
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < minIntervalMs) {
      await this.sleep(minIntervalMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
