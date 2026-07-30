import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApplicationStatus } from '@ai-career/shared';

export class CreateApplicationDto {
  @ApiPropertyOptional({ description: 'Link to a platform job. Omit for manual entries.' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ description: 'Required when jobId is omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Required when jobId is omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ enum: ApplicationStatus, default: ApplicationStatus.SAVED })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  jobUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  salaryNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resumeUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  coverLetter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  notes?: string;

  @ApiPropertyOptional({ description: 'ISO date the application was submitted' })
  @IsOptional()
  @IsDateString()
  appliedAt?: string;

  @ApiPropertyOptional({ description: 'ISO date for the next follow-up reminder' })
  @IsOptional()
  @IsDateString()
  nextActionAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nextActionNote?: string;
}

export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {
  @ApiPropertyOptional({ description: 'Position within its board column' })
  @IsOptional()
  @IsInt()
  @Min(0)
  boardOrder?: number;
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @ApiPropertyOptional({ description: 'Optional note recorded with the transition' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'New position within the target column' })
  @IsOptional()
  @IsInt()
  @Min(0)
  boardOrder?: number;
}
