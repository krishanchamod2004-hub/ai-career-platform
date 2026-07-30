import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { JobsService } from './jobs.service';
import { QueryJobsDto } from './dto/query-jobs.dto';

/**
 * Public job discovery API. All routes use @OptionalAuth: anonymous visitors get
 * the public feed, authenticated callers additionally get `isSaved` flags and any
 * early-access listings their plan unlocks.
 */
@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @OptionalAuth()
  @Get()
  @ApiOperation({ summary: 'Search jobs with filters, sorting, and pagination' })
  @ApiOkResponse({ description: 'Paginated job list with meta.nextCursor for infinite scroll' })
  search(@Query() query: QueryJobsDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.jobsService.search(query, user);
  }

  @OptionalAuth()
  @Get('facets')
  @ApiOperation({ summary: 'Aggregate counts for the current filter set' })
  facets(@Query() query: QueryJobsDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.jobsService.facets(query, user);
  }

  @OptionalAuth()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get a single job by id or slug' })
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.jobsService.findOne(idOrSlug, user);
  }

  @OptionalAuth()
  @Get(':id/similar')
  @ApiOperation({ summary: 'Related jobs (same company or overlapping skills)' })
  @ApiQuery({ name: 'limit', required: false, example: 6 })
  findSimilar(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.jobsService.findSimilar(id, limit ?? 6, user);
  }
}
