import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { AiProvider } from '@ai-career/shared';
import { redactSecrets, toAiHttpException } from './ai-provider.errors';

export const DEFAULT_AI_TIMEOUT_MS = 60_000;
export const DEFAULT_AI_MAX_OUTPUT_TOKENS = 1_200;
/** Total attempts, not retries. Kept low: every attempt spends the user's money. */
export const DEFAULT_AI_MAX_ATTEMPTS = 2;

/**
 * Shared transport for LLM vendors.
 *
 * Differs from `ScraperHttpClient` on purpose: no global rate limiter (the limit
 * belongs to the caller's own vendor account, not to us) and a much smaller retry
 * budget, because each retry is a billable request against a user's key.
 */
export abstract class BaseAiProvider {
  protected readonly logger = new Logger(this.constructor.name);
  private readonly http: AxiosInstance;

  protected constructor(
    protected readonly config: ConfigService | undefined,
    baseURL: string,
  ) {
    this.http = axios.create({
      baseURL,
      // Only 2xx resolves; everything else is classified by toAiHttpException.
      validateStatus: (status) => status >= 200 && status < 300,
    });
  }

  protected get timeoutMs(): number {
    return Number(this.config?.get('AI_REQUEST_TIMEOUT_MS')) || DEFAULT_AI_TIMEOUT_MS;
  }

  protected get maxOutputTokens(): number {
    return Number(this.config?.get('AI_MAX_OUTPUT_TOKENS')) || DEFAULT_AI_MAX_OUTPUT_TOKENS;
  }

  protected get maxAttempts(): number {
    return Number(this.config?.get('AI_MAX_ATTEMPTS')) || DEFAULT_AI_MAX_ATTEMPTS;
  }

  /**
   * POSTs with one bounded retry on transient failures (429/5xx/network).
   * 4xx other than 429 fails immediately — retrying a rejected key or an unknown
   * model just burns latency.
   */
  protected async post<T>(
    provider: AiProvider,
    path: string,
    body: unknown,
    headers: Record<string, string>,
    timeoutMs?: number,
  ): Promise<T> {
    const attempts = Math.max(1, this.maxAttempts);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.http.post<T>(path, body, {
          headers: { 'content-type': 'application/json', ...headers },
          timeout: timeoutMs ?? this.timeoutMs,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const isTransient = !status || status === 429 || status >= 500;

        if (!isTransient || attempt === attempts) {
          break;
        }

        const retryAfter = Number(axiosError.response?.headers?.['retry-after']);
        const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(10_000, retryAfter * 1000)
          : 1_000 * attempt;

        this.logger.warn(
          `${provider} ${path} failed (${status ?? axiosError.code}); retrying in ${backoffMs}ms ` +
            `(attempt ${attempt}/${attempts})`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    const exception = toAiHttpException(provider, lastError);
    this.logger.warn(
      `${provider} request failed: ${redactSecrets(String((lastError as Error)?.message ?? 'unknown'))}`,
    );
    throw exception;
  }
}
