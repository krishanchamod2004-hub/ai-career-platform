import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, DEFAULT_AI_MODELS } from '@ai-career/shared';
import { BaseAiProvider } from './base-ai.provider';
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProviderClient,
} from './ai-provider.interface';

const OPENAI_BASE_URL = 'https://api.openai.com';

interface OpenAiChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * OpenAI via Chat Completions, using the caller's own key.
 *
 * `response_format: json_object` guarantees syntactically valid JSON, so the
 * parser only has to validate semantics (ranges, required criteria) rather than
 * scrape prose.
 */
@Injectable()
export class OpenAiProvider extends BaseAiProvider implements AiProviderClient {
  readonly provider = AiProvider.OPENAI;
  readonly defaultModel = DEFAULT_AI_MODELS[AiProvider.OPENAI];

  constructor(config: ConfigService) {
    super(config, OPENAI_BASE_URL);
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const data = await this.post<OpenAiChatResponse>(
      this.provider,
      '/v1/chat/completions',
      {
        model: request.model || this.defaultModel,
        max_tokens: request.maxOutputTokens ?? this.maxOutputTokens,
        temperature: request.temperature ?? 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ],
      },
      { authorization: `Bearer ${request.apiKey}` },
      request.timeoutMs,
    );

    return {
      text: (data.choices?.[0]?.message?.content ?? '').trim(),
      model: data.model ?? request.model,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
    };
  }
}
