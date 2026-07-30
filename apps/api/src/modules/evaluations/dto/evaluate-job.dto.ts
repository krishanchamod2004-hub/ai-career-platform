import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { EvaluationGrade, EvaluationSortBy } from '@ai-career/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Body of POST /evaluations/jobs/:jobId.
 *
 * Note what is *not* here: the provider API key. Credentials travel in the
 * `x-ai-*` headers (see ai-credentials.ts) so they can never be echoed back by
 * DTO validation errors or captured in a body log.
 */
export class EvaluateJobDto {
  @ApiPropertyOptional({
    description:
      'Re-run the evaluation and overwrite the stored one. Without this, an existing evaluation is returned and no tokens are spent.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  force?: boolean;
}

export class QueryEvaluationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EvaluationGrade, description: 'Only evaluations with this grade' })
  @IsOptional()
  @IsEnum(EvaluationGrade)
  grade?: EvaluationGrade;

  @ApiPropertyOptional({ enum: EvaluationSortBy, default: EvaluationSortBy.SCORE_DESC })
  @IsOptional()
  @IsEnum(EvaluationSortBy)
  sortBy?: EvaluationSortBy;
}

export class QueryEvaluationGradesDto {
  @ApiPropertyOptional({
    description: 'Comma-separated job ids to look up grades for (max 100).',
  })
  @IsOptional()
  @IsString()
  jobIds?: string;
}
