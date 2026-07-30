import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
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
  AlertFrequency,
  ExperienceLevel,
  JobType,
  NotificationChannel,
  WorkLocationType,
} from '@ai-career/shared';

export class CreateJobAlertDto {
  @ApiProperty({ example: 'Senior React roles in Europe' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ type: [String], example: ['react', 'frontend'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Berlin', 'Remote'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  locations?: string[];

  @ApiPropertyOptional({ enum: JobType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(JobType, { each: true })
  jobTypes?: JobType[];

  @ApiPropertyOptional({ enum: WorkLocationType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(WorkLocationType, { each: true })
  workModels?: WorkLocationType[];

  @ApiPropertyOptional({ enum: ExperienceLevel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ExperienceLevel, { each: true })
  experienceLevels?: ExperienceLevel[];

  @ApiPropertyOptional({ type: [String], example: ['TypeScript', 'React'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: 90000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRemoteOnly?: boolean;

  @ApiPropertyOptional({ enum: AlertFrequency, default: AlertFrequency.DAILY })
  @IsOptional()
  @IsEnum(AlertFrequency)
  frequency?: AlertFrequency;

  @ApiPropertyOptional({ enum: NotificationChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateJobAlertDto extends PartialType(CreateJobAlertDto) {}
