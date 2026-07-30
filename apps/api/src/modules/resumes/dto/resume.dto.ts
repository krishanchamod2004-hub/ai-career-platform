import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Multipart form fields alongside the uploaded file in POST /resumes/upload. */
export class UploadResumeDto {
  @ApiPropertyOptional({ description: 'Display name, e.g. "Frontend Dev Resume"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    description: 'Make this the default resume used for quick ATS checks from job cards.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateResumeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isDefault?: boolean;
}

/** Body of POST /resumes/ats-score. */
export class AtsScoreRequestDto {
  @ApiPropertyOptional({ description: 'Resume to grade' })
  @IsUUID()
  resumeId!: string;

  @ApiPropertyOptional({ description: 'Job to grade the resume against' })
  @IsUUID()
  jobId!: string;

  @ApiPropertyOptional({
    description: 'Re-run and overwrite the stored score instead of returning the cached one.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  force?: boolean;
}
