import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@ai-career/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Personal dashboard counters' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getUserSummary(user.id);
  }

  @Get('overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Platform-wide metrics (admin)' })
  overview() {
    return this.analyticsService.getOverview();
  }

  @Get('daily')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Daily metric time series (admin)' })
  daily(@Query('days', new ParseIntPipe({ optional: true })) days?: number) {
    return this.analyticsService.getDailySeries(days ?? 30);
  }
}
