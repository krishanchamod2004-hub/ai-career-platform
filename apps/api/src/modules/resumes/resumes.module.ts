import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { BillingModule } from '../billing/billing.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';

/**
 * Resume storage + AI ATS (Applicant Tracking System) match scoring.
 *
 * Imports EvaluationsModule to reuse its BYOK AiProviderRegistry singleton
 * (same vendor clients, same "no platform key, ever" policy) instead of
 * re-registering the Anthropic/OpenAI providers a second time.
 * Files are buffered in memory by Multer, then written to disk once by
 * ResumesService (see the storage caveat there).
 */
@Module({
  imports: [
    BillingModule,
    EvaluationsModule,
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [ResumesController],
  providers: [ResumesService],
  exports: [ResumesService],
})
export class ResumesModule {}
