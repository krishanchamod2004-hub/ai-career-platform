import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApplicationStatus, PlanFeature } from '@ai-career/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  UpdateApplicationStatusDto,
} from './dto/application.dto';

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List applications' })
  @ApiQuery({ name: 'status', required: false, enum: ApplicationStatus })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: ApplicationStatus,
  ) {
    return this.applicationsService.list(user.id, { ...pagination, status });
  }

  @Get('board')
  @ApiOperation({ summary: 'Applications grouped by status (Kanban board)' })
  board(@CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.board(user.id);
  }

  @Get('stats')
  @RequireFeature(PlanFeature.APPLICATION_ANALYTICS)
  @ApiOperation({ summary: 'Application funnel analytics (Pro/Premium)' })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.stats(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Track a new application (from a job or manually)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one application with its status history' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applicationsService.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update application fields' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(user.id, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Move an application to another status (board drag)' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateStatus(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an application' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applicationsService.remove(user.id, id);
  }
}
