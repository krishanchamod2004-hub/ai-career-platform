import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { JobAlertsService } from './job-alerts.service';
import { CreateJobAlertDto, UpdateJobAlertDto } from './dto/job-alert.dto';

@ApiTags('job-alerts')
@ApiBearerAuth()
@Controller('job-alerts')
export class JobAlertsController {
  constructor(private readonly jobAlertsService: JobAlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List job alerts' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.jobAlertsService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a job alert (plan limits apply)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobAlertDto) {
    return this.jobAlertsService.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one job alert' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobAlertsService.get(user.id, id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview jobs currently matching this alert' })
  preview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobAlertsService.preview(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a job alert' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateJobAlertDto,
  ) {
    return this.jobAlertsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a job alert' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobAlertsService.remove(user.id, id);
  }
}
