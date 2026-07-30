import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import type { ResetPasswordDto as IResetPasswordDto } from '@ai-career/shared';

export class ResetPasswordDto implements IResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123!', minLength: 8 })
  @IsString()
  @Length(8, 128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword!: string;
}
