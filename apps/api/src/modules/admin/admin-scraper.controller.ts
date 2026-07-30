import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@ai-career/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { JobSourcesService } from '../scraper/services/job-sources.service';
import { ScraperService } from '../scraper/services/scraper.service';
import { QueueService } from '../queue/queue.service';
import { AdminListRunsDto, UpsertJobSourceDto } from './dto/admin.dto';

@ApiTags('admin-scraper')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/scraper')
export class AdminScraperController {
  constructor(
    private readonly adminService: AdminService,
    private readonly sources: JobSourcesService,
    private readonly scraper: ScraperService,
    private readonly queue: QueueService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Per-source health: last run, 24h success rate, ingested volume' })
  status() {
    return this.adminService.getScraperStatus();
  }

  @Get('sources')
  @ApiOperation({ summary: 'List configured job sources' })
  listSources() {
    return this.sources.list();
  }

  @Post('sources')
  @ApiOperation({ summary: 'Create a job source (schedules its cron immediately)' })
  createSource(@Body() dto: UpsertJobSourceDto) {
    return this.sources.create(dto);
  }

  @Patch('sources/:id')
  @ApiOperation({ summary: 'Update a job source (re-syncs its schedule)' })
  updateSource(@Param('id') id: string, @Body() dto: UpsertJobSourceDto) {
    return this.sources.update(id, dto);
  }

  @Delete('sources/:id')
  @ApiOperation({ summary: 'Delete a job source and unschedule it' })
  deleteSource(@Param('id') id: string) {
    return this.sources.remove(id);
  }

  @Post('sources/:id/trigger')
  @ApiOperation({ summary: 'Queue an immediate scrape for a source' })
  @ApiQuery({ name: 'fullSync', required: false, type: Boolean })
  triggerSource(@Param('id') id: string, @Query('fullSync') fullSync?: string) {
    return this.scraper.triggerSource(id, fullSync === 'true');
  }

  @Get('runs')
  @ApiOperation({ summary: 'Scraper run history' })
  listRuns(@Query() query: AdminListRunsDto) {
    return this.adminService.listRuns(query);
  }

  @Get('runs/failed')
  @ApiOperation({ summary: 'Failed scraper runs (triage queue)' })
  listFailedRuns(@Query() query: AdminListRunsDto) {
    return this.adminService.listFailedRuns(query);
  }

  @Post('runs/:runId/retry')
  @ApiOperation({ summary: 'Re-queue the source behind a failed run' })
  retryRun(@Param('runId') runId: string) {
    return this.adminService.retryRun(runId);
  }

  @Get('queues')
  @ApiOperation({ summary: 'BullMQ queue depths and failure counts' })
  queues() {
    return this.queue.getStats();
  }
}
