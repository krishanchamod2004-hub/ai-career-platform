import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ExperienceLevel,
  JobSortBy,
  JobType,
  WorkLocationType,
} from '@ai-career/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Splits `?jobTypes=FULL_TIME,CONTRACT` and repeated params into a string array. */
function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((entry) => String(entry).trim()).filter(Boolean);
}

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return undefined;
}

export class QueryJobsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search across title, company, and description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: JobSortBy, default: JobSortBy.NEWEST })
  @IsOptional()
  @IsEnum(JobSortBy)
  sortBy?: JobSortBy = JobSortBy.NEWEST;

  @ApiPropertyOptional({ description: 'Remote-only when true' })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isRemote?: boolean;

  @ApiPropertyOptional({ enum: JobType, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(JobType, { each: true })
  jobTypes?: JobType[];

  @ApiPropertyOptional({ enum: WorkLocationType, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(WorkLocationType, { each: true })
  workModels?: WorkLocationType[];

  @ApiPropertyOptional({ enum: ExperienceLevel, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(ExperienceLevel, { each: true })
  experienceLevels?: ExperienceLevel[];

  @ApiPropertyOptional({ description: 'Minimum yearly salary (normalized)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ description: 'Maximum yearly salary (normalized)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({ example: 'Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ example: 'Germany' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceSlug?: string;

  @ApiPropertyOptional({ description: 'Premium filter: required skills', type: [String] })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Only jobs posted within the last N days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  postedWithinDays?: number;

  @ApiPropertyOptional({ description: 'Premium filter: visa sponsorship offered' })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  visaSponsorship?: boolean;

  @ApiPropertyOptional({ description: 'Include expired/filled listings (admin & saved views)' })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeExpired?: boolean;
}
