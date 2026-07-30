import type { AiProvider } from '@ai-career/shared';

/**
 * One completion request against a user-supplied key.
 *
 * `apiKey` is passed through per call and is never stored on the provider
 * instance — providers are singletons shared by every request, so holding a key
 * as instance state would leak it across users.
 */
export interface AiCompletionRequest {
  apiKey: string;
  model: string;
  /** Instruction block: role, rubric, output contract. */
  system: string;
  /** The candidate/job payload to score. */
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AiCompletionResult {
  /** Raw assistant text. Parsing/validation is the caller's job. */
  text: string;
  /** Model the vendor reports actually serving the request. */
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/**
 * Vendor-agnostic completion port.
 *
 * Mirrors how `JobSourceAdapter` isolates scraping: vendors differ only in wire
 * format, so everything above this line (prompting, parsing, persistence) is
 * written once.
 */
export interface AiProviderClient {
  readonly provider: AiProvider;
  readonly defaultModel: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
