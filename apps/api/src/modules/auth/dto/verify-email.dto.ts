import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import type { VerifyEmailDto as IVerifyEmailDto } from '@ai-career/shared';

export class VerifyEmailDto implements IVerifyEmailDto {
  @ApiProperty()
  @IsString()
  token!: string;
}
