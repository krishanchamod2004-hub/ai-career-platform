import { BadRequestException, Injectable } from '@nestjs/common';
import { AiProvider } from '@ai-career/shared';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAiProvider } from './openai.provider';
import type { AiProviderClient } from './ai-provider.interface';

/**
 * Resolves an {@link AiProvider} to its client. Adding a vendor (Gemini, Ollama)
 * means implementing `AiProviderClient` and registering it here — no change to
 * prompting, parsing or persistence.
 */
@Injectable()
export class AiProviderRegistry {
  private readonly clients: Map<AiProvider, AiProviderClient>;

  constructor(anthropic: AnthropicProvider, openai: OpenAiProvider) {
    this.clients = new Map<AiProvider, AiProviderClient>([
      [AiProvider.ANTHROPIC, anthropic],
      [AiProvider.OPENAI, openai],
    ]);
  }

  get(provider: AiProvider): AiProviderClient {
    const client = this.clients.get(provider);
    if (!client) {
      throw new BadRequestException(`Unsupported AI provider: ${provider}`);
    }
    return client;
  }

  listProviders(): AiProvider[] {
    return [...this.clients.keys()];
  }
}
