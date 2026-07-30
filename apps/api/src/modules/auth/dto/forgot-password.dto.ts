import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import type { ForgotPasswordDto as IForgotPasswordDto } from '@ai-career/shared';

export class ForgotPasswordDto implements IForgotPasswordDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;
}
