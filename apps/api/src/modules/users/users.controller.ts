import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessageResponse } from '@ai-career/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/profile')
  @ApiOperation({ summary: 'Get the current user profile' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update the current user profile' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('onboarding-complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark the onboarding tour as completed for the current user' })
  async markOnboardingComplete(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponse> {
    await this.usersService.markOnboardingComplete(user.id);
    return { message: 'Onboarding marked as complete' };
  }
}
