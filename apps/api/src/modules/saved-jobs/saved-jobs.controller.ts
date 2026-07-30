import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SavedJobsService } from './saved-jobs.service';
import { CreateSavedJobDto, UpdateSavedJobDto } from './dto/saved-job.dto';

@ApiTags('saved-jobs')
@ApiBearerAuth()
@Controller('saved-jobs')
export class SavedJobsController {
  constructor(private readonly savedJobsService: SavedJobsService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s saved jobs' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationQueryDto) {
    return this.savedJobsService.list(user.id, pagination);
  }

  @Get('ids')
  @ApiOperation({ summary: 'Saved job ids (for bookmark state in lists)' })
  listIds(@CurrentUser() user: AuthenticatedUser) {
    return this.savedJobsService.listSavedIds(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Save/bookmark a job (subject to plan limits)' })
  save(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSavedJobDto) {
    return this.savedJobsService.save(user.id, dto.jobId, dto.notes);
  }

  @Patch(':jobId')
  @ApiOperation({ summary: 'Update the note on a saved job' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Body() dto: UpdateSavedJobDto,
  ) {
    return this.savedJobsService.updateNotes(user.id, jobId, dto.notes ?? null);
  }

  @Delete(':jobId')
  @ApiOperation({ summary: 'Remove a saved job' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('jobId') jobId: string) {
    return this.savedJobsService.remove(user.id, jobId);
  }
}
