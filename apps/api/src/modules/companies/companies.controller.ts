import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CompaniesService } from './companies.service';
import { JobsService } from '../jobs/jobs.service';
import { QueryJobsDto } from '../jobs/dto/query-jobs.dto';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly jobsService: JobsService,
  ) {}

  @OptionalAuth()
  @Get()
  @ApiOperation({ summary: 'List companies with open job counts' })
  list(@Query() pagination: PaginationQueryDto, @Query('q') q?: string) {
    return this.companiesService.list({ q, page: pagination.page, pageSize: pagination.pageSize });
  }

  @OptionalAuth()
  @Get(':idOrSlug')
  @ApiOperation({
    summary: 'Company profile (hiring insights included for Premium plans)',
  })
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.companiesService.findOne(idOrSlug, user);
  }

  @OptionalAuth()
  @Get(':idOrSlug/jobs')
  @ApiOperation({ summary: 'Open jobs at a company' })
  async listJobs(
    @Param('idOrSlug') idOrSlug: string,
    @Query() query: QueryJobsDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const companyId = await this.companiesService.resolveId(idOrSlug);
    return this.jobsService.search({ ...query, companyId }, user);
  }
}
