import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JobStatus, UserRole } from '@ai-career/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AdminService } from './admin.service';
import {
  AdminListLogsDto,
  AdminListUsersDto,
  AdminUpdateCompanyDto,
  AdminUpdateJobDto,
  UpdateUserPlanDto,
  UpdateUserRoleDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Admin dashboard counters' })
  summary() {
    return this.adminService.getDashboardSummary();
  }

  // --- users ---------------------------------------------------------------

  @Get('users')
  @ApiOperation({ summary: 'List users with plan and usage counts' })
  listUsers(@Query() query: AdminListUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change a user role' })
  updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @Patch('users/:id/plan')
  @ApiOperation({ summary: 'Grant or downgrade a subscription plan (no payment provider yet)' })
  updateUserPlan(@Param('id') id: string, @Body() dto: UpdateUserPlanDto) {
    return this.adminService.updateUserPlan(id, dto);
  }

  // --- jobs ----------------------------------------------------------------

  @Get('jobs')
  @ApiOperation({ summary: 'List jobs including expired/archived' })
  listJobs(
    @Query() pagination: PaginationQueryDto,
    @Query('q') q?: string,
    @Query('status') status?: JobStatus,
    @Query('sourceId') sourceId?: string,
  ) {
    return this.adminService.listJobs({ ...pagination, q, status, sourceId });
  }

  @Patch('jobs/:id')
  @ApiOperation({ summary: 'Update job status or lift the early-access embargo' })
  updateJob(@Param('id') id: string, @Body() dto: AdminUpdateJobDto) {
    return this.adminService.updateJob(id, dto);
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Delete a job' })
  deleteJob(@Param('id') id: string) {
    return this.adminService.deleteJob(id);
  }

  // --- companies -----------------------------------------------------------

  @Get('companies')
  @ApiOperation({ summary: 'List companies with job counts' })
  listCompanies(@Query() pagination: PaginationQueryDto, @Query('q') q?: string) {
    return this.adminService.listCompanies({ ...pagination, q });
  }

  @Patch('companies/:id')
  @ApiOperation({ summary: 'Enrich or verify a company profile' })
  updateCompany(@Param('id') id: string, @Body() dto: AdminUpdateCompanyDto) {
    return this.adminService.updateCompany(id, dto);
  }

  // --- logs ----------------------------------------------------------------

  @Get('logs')
  @ApiOperation({ summary: 'Scraper or system logs (channel=scraper|system)' })
  listLogs(@Query() query: AdminListLogsDto) {
    return this.adminService.listLogs(query);
  }
}
