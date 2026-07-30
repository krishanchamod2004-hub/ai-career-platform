import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AI_HEADERS, AiProvider, type AiCredentials } from '@ai-career/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { EvaluationsService } from './evaluations.service';
import { AiCredentialsHeaders } from './ai/ai-credentials';
import {
  EvaluateJobDto,
  QueryEvaluationGradesDto,
  QueryEvaluationsDto,
} from './dto/evaluate-job.dto';

@ApiTags('evaluations')
@ApiBearerAuth()
@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s AI job evaluations' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEvaluationsDto) {
    return this.evaluationsService.list(user.id, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Grade distribution and average score for the dashboard' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.evaluationsService.summarize(user.id);
  }

  @Get('models')
  @ApiOperation({ summary: 'Models offered in the API-key modal, per provider' })
  models() {
    return this.evaluationsService.listModels();
  }

  @Get('grades')
  @ApiOperation({
    summary: 'Grade-only projection for badging job lists',
    description: 'Pass `jobIds` as a comma-separated list to scope the lookup to a page of results.',
  })
  grades(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEvaluationGradesDto) {
    const jobIds = query.jobIds
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.evaluationsService.listGrades(user.id, jobIds);
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Stored evaluation for one job' })
  findForJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.evaluationsService.findForJob(user.id, jobId);
  }

  /**
   * Evaluate a job with the caller's own LLM key (BYOK).
   *
   * Throttled well below the global 100/min: each call is a paid third-party
   * request, so a runaway client should hit our limit long before it runs up a
   * bill on the user's provider account.
   */
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('jobs/:jobId')
  @ApiOperation({ summary: 'Evaluate a job against the caller’s profile using their own AI key' })
  @ApiHeader({
    name: AI_HEADERS.PROVIDER,
    required: true,
    description: `AI vendor: ${Object.values(AiProvider).join(' | ')}`,
  })
  @ApiHeader({
    name: AI_HEADERS.API_KEY,
    required: true,
    description: 'The caller’s own provider API key. Never stored or logged.',
  })
  @ApiHeader({
    name: AI_HEADERS.MODEL,
    required: false,
    description: 'Model id override; the provider default is used when omitted.',
  })
  evaluate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: EvaluateJobDto,
    @AiCredentialsHeaders() credentials: AiCredentials,
  ) {
    return this.evaluationsService.evaluate(user, jobId, credentials, { force: dto.force });
  }

  @Delete('jobs/:jobId')
  @ApiOperation({ summary: 'Delete a stored evaluation' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.evaluationsService.remove(user.id, jobId);
  }
}
