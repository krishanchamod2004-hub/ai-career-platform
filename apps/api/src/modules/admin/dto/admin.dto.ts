import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  JobSourceType,
  JobStatus,
  LogLevel,
  PlanTier,
  ScraperRunStatus,
  SubscriptionStatus,
  UserRole,
} from '@ai-career/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AdminListUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by email or name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: PlanTier })
  @IsOptional()
  @IsEnum(PlanTier)
  plan?: PlanTier;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateUserPlanDto {
  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier)
  plan!: PlanTier;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Length of the granted period in days', example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodDays?: number;
}

export class AdminUpdateJobDto {
  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional({ description: 'Clear or extend the early-access embargo' })
  @IsOptional()
  @IsBoolean()
  clearEarlyAccess?: boolean;
}

export class AdminUpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  websiteUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string;

  @ApiPropertyOptional({ example: '201-500' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  companySize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headquarters?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

export class UpsertJobSourceDto {
  @ApiPropertyOptional({ description: 'Required on create' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  slug?: string;

  @ApiPropertyOptional({ description: 'Required on create' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: JobSourceType, description: 'Required on create' })
  @IsOptional()
  @IsEnum(JobSourceType)
  type?: JobSourceType;

  @ApiPropertyOptional({
    description: 'Adapter config',
    example: { boards: [{ slug: 'stripe', name: 'Stripe' }] },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: '0 */6 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  cronExpression?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestsPerMinute?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;
}

export class AdminListRunsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ScraperRunStatus })
  @IsOptional()
  @IsEnum(ScraperRunStatus)
  status?: ScraperRunStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;
}

export class AdminListLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LogLevel })
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  @ApiPropertyOptional({ description: 'scraper | system' , example: 'scraper' })
  @IsOptional()
  @IsString()
  channel?: 'scraper' | 'system';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;
}
