import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSavedJobDto {
  @ApiProperty({ description: 'Job id to bookmark' })
  @IsUUID()
  jobId!: string;

  @ApiPropertyOptional({ description: 'Private note attached to the bookmark' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateSavedJobDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
