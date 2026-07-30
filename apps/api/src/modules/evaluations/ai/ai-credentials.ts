import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  AI_HEADERS,
  AiProvider,
  DEFAULT_AI_MODELS,
  type AiCredentials,
} from '@ai-career/shared';
import { AI_ERROR_CODES } from './ai-provider.errors';

/** Guards against header-injection and absurd payloads before we forward a key. */
const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 500;
/** Vendor model ids are conservative slugs; anything else is a client bug. */
const MODEL_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

function headerValue(request: Request, name: string): string | undefined {
  const raw = request.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Reads BYOK credentials from request headers.
 *
 * Headers rather than the JSON body so the key never reaches body-validation
 * error echoes, request logs or Swagger examples — and so a DTO can never
 * accidentally persist it. Nothing here is written to the database.
 */
export function extractAiCredentials(request: Request): AiCredentials {
  const providerHeader = headerValue(request, AI_HEADERS.PROVIDER)?.toUpperCase();
  const apiKey = headerValue(request, AI_HEADERS.API_KEY);
  const model = headerValue(request, AI_HEADERS.MODEL);

  if (!providerHeader || !apiKey) {
    throw new BadRequestException({
      message:
        `Missing AI credentials. Send \`${AI_HEADERS.PROVIDER}\` and \`${AI_HEADERS.API_KEY}\` ` +
        'headers with your own provider key.',
      error: AI_ERROR_CODES.CREDENTIALS_MISSING,
    });
  }

  if (!Object.values(AiProvider).includes(providerHeader as AiProvider)) {
    throw new BadRequestException({
      message: `Unsupported AI provider "${providerHeader}". Supported: ${Object.values(AiProvider).join(', ')}.`,
      error: AI_ERROR_CODES.CREDENTIALS_MISSING,
    });
  }

  if (apiKey.length < MIN_KEY_LENGTH || apiKey.length > MAX_KEY_LENGTH) {
    throw new BadRequestException({
      message: 'The supplied API key does not look like a valid provider key.',
      error: AI_ERROR_CODES.CREDENTIALS_MISSING,
    });
  }

  // Control characters in a forwarded header value are a request-splitting risk.
  if (/[\s\u0000-\u001f\u007f]/.test(apiKey)) {
    throw new BadRequestException({
      message: 'The supplied API key contains invalid characters.',
      error: AI_ERROR_CODES.CREDENTIALS_MISSING,
    });
  }

  if (model && !MODEL_PATTERN.test(model)) {
    throw new BadRequestException({
      message: `Invalid model id in \`${AI_HEADERS.MODEL}\`.`,
      error: AI_ERROR_CODES.CREDENTIALS_MISSING,
    });
  }

  const provider = providerHeader as AiProvider;
  return { provider, apiKey, model: model ?? DEFAULT_AI_MODELS[provider] };
}

/** `@AiCredentialsHeaders() credentials: AiCredentials` on a controller method. */
export const AiCredentialsHeaders = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AiCredentials =>
    extractAiCredentials(context.switchToHttp().getRequest<Request>()),
);
