import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { AI_PROVIDER_LABELS, type AiProvider } from '@ai-career/shared';

/** Error codes clients switch on (the web app maps these to specific UI states). */
export const AI_ERROR_CODES = {
  KEY_REJECTED: 'AI_KEY_REJECTED',
  REQUEST_REJECTED: 'AI_REQUEST_REJECTED',
  QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  RATE_LIMITED: 'AI_RATE_LIMITED',
  UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  UNPARSEABLE: 'AI_RESPONSE_UNPARSEABLE',
  CREDENTIALS_MISSING: 'AI_CREDENTIALS_MISSING',
} as const;

/**
 * Strips anything that looks like a credential out of text we echo back.
 *
 * Vendors sometimes include a key fragment in their error messages, and those
 * messages are surfaced to the browser and written to logs.
 */
export function redactSecrets(input: string): string {
  return input
    .replace(/sk-[A-Za-z0-9._-]{6,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer ***');
}

function providerMessage(error: AxiosError): string | null {
  const data = error.response?.data as
    | { error?: { message?: string; type?: string; code?: string }; message?: string }
    | undefined;
  const raw = data?.error?.message ?? data?.message ?? null;
  return raw ? redactSecrets(String(raw)).slice(0, 300) : null;
}

/**
 * Translates a vendor failure into an HTTP error for our own clients.
 *
 * Deliberately never returns 401/403: the web app's axios interceptor treats a
 * 401 as an expired session and silently retries after a token refresh, so
 * mapping a rejected *LLM* key to 401 would cause a confusing double request and
 * hide the real cause. A bad BYOK key is a bad request payload, not an auth
 * failure against this API.
 */
export function toAiHttpException(provider: AiProvider, error: unknown): HttpException {
  const label = AI_PROVIDER_LABELS[provider] ?? provider;

  if (error instanceof HttpException) {
    return error;
  }

  const axiosError = error as AxiosError;
  const status = axiosError?.response?.status;
  const detail = providerMessage(axiosError);

  if (status === 401 || status === 403) {
    return new BadRequestException({
      message: `${label} rejected the API key you supplied. Check the key and try again.`,
      error: AI_ERROR_CODES.KEY_REJECTED,
      provider,
      detail,
    });
  }

  if (status === 429) {
    // Anthropic/OpenAI both use 429 for "out of credit" as well as burst limits.
    const isQuota = Boolean(detail && /quota|credit|billing/i.test(detail));
    return new HttpException(
      {
        message: isQuota
          ? `Your ${label} account has no remaining quota for this model.`
          : `${label} rate-limited this request. Wait a moment and retry.`,
        error: isQuota ? AI_ERROR_CODES.QUOTA_EXCEEDED : AI_ERROR_CODES.RATE_LIMITED,
        provider,
        detail,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  if (status === 402) {
    return new HttpException(
      {
        message: `Your ${label} account needs billing set up before it can serve requests.`,
        error: AI_ERROR_CODES.QUOTA_EXCEEDED,
        provider,
        detail,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  if (status && status >= 400 && status < 500) {
    // Usually an unknown model id or a malformed request we built.
    return new BadRequestException({
      message: `${label} rejected the request${detail ? `: ${detail}` : '.'}`,
      error: AI_ERROR_CODES.REQUEST_REJECTED,
      provider,
      detail,
    });
  }

  return new ServiceUnavailableException({
    message: `${label} is unavailable right now. Try again shortly.`,
    error: AI_ERROR_CODES.UNAVAILABLE,
    provider,
    detail: detail ?? redactSecrets(axiosError?.message ?? 'unknown error'),
  });
}
