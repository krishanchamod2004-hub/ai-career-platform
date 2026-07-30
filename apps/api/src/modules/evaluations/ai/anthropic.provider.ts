import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, DEFAULT_AI_MODELS } from '@ai-career/shared';
import { BaseAiProvider } from './base-ai.provider';
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProviderClient,
} from './ai-provider.interface';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
/** Pinned: Anthropic requires an explicit version header and treats it as the contract. */
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessagesResponse {
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Claude via the Messages API, using the caller's own key.
 *
 * Anthropic has no JSON mode, so determinism comes from the prompt (a strict
 * output contract) plus prefilling the assistant turn with `{` — which reliably
 * suppresses the "Here is the JSON:" preamble that would otherwise break parsing.
 */
@Injectable()
export class AnthropicProvider extends BaseAiProvider implements AiProviderClient {
  readonly provider = AiProvider.ANTHROPIC;
  readonly defaultModel = DEFAULT_AI_MODELS[AiProvider.ANTHROPIC];

  constructor(config: ConfigService) {
    super(config, ANTHROPIC_BASE_URL);
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const data = await this.post<AnthropicMessagesResponse>(
      this.provider,
      '/v1/messages',
      {
        model: request.model || this.defaultModel,
        max_tokens: request.maxOutputTokens ?? this.maxOutputTokens,
        temperature: request.temperature ?? 0,
        system: request.system,
        messages: [
          { role: 'user', content: request.prompt },
          // Assistant prefill: the completion continues from this token, so the
          // reply is a JSON body with the opening brace already emitted.
          { role: 'assistant', content: '{' },
        ],
      },
      {
        'x-api-key': request.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      request.timeoutMs,
    );

    const text = (data.content ?? [])
      .filter((block) => (block.type ?? 'text') === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();

    return {
      // Re-attach the prefilled brace so the caller receives complete JSON.
      text: text.startsWith('{') ? text : `{${text}`,
      model: data.model ?? request.model,
      promptTokens: data.usage?.input_tokens ?? null,
      completionTokens: data.usage?.output_tokens ?? null,
    };
  }
}
