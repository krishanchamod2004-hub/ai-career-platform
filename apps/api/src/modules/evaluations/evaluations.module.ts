import { Module } from '@nestjs/common';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { AiProviderRegistry } from './ai/ai-provider.registry';
import { AnthropicProvider } from './ai/anthropic.provider';
import { OpenAiProvider } from './ai/openai.provider';

/**
 * AI evaluation module (BYOK).
 *
 * The platform holds no vendor credentials of its own: every call carries the
 * user's key in request headers, which is why there is no provider secret in the
 * environment and nothing to rotate here.
 */
@Module({
  controllers: [EvaluationsController],
  providers: [EvaluationsService, AiProviderRegistry, AnthropicProvider, OpenAiProvider],
  // AiProviderRegistry is exported so other BYOK-based modules (ResumesModule's
  // ATS scorer) can reuse the same vendor clients instead of re-registering them.
  exports: [EvaluationsService, AiProviderRegistry],
})
export class EvaluationsModule {}
