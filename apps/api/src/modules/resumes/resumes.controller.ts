import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AI_HEADERS, AiProvider, type AiCredentials } from '@ai-career/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AiCredentialsHeaders } from '../evaluations/ai/ai-credentials';
import { ResumesService } from './resumes.service';
import { AtsScoreRequestDto, UpdateResumeDto, UploadResumeDto } from './dto/resume.dto';

@ApiTags('resumes')
@ApiBearerAuth()
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's resumes" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.resumesService.list(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one resume, including its extracted text' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.resumesService.findOne(user.id, id);
  }

  /**
   * Multipart upload: extracts text from the PDF server-side via pdf-parse so
   * the ATS scorer (and any future feature) only ever handles plain text.
   * Enforces the free-plan resume cap before doing any work.
   */
  @Post('upload')
  @ApiOperation({ summary: 'Upload a PDF resume; extracts and stores its text' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadResumeDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Send it as multipart field "file".');
    }
    return this.resumesService.upload(
      user.id,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
      { title: dto.title, isDefault: dto.isDefault },
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a resume or set it as the default' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResumeDto,
  ) {
    return this.resumesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resume and its stored file' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.resumesService.remove(user.id, id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Download the original uploaded PDF' })
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { path: filePath, title } = await this.resumesService.resolveFilePath(user.id, id);
    res.download(filePath, `${title}.pdf`);
  }

  /**
   * Grade a resume against a job with the caller's own LLM key (BYOK) — same
   * credential/throttling pattern as POST /evaluations/jobs/:jobId.
   */
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('ats-score')
  @ApiOperation({ summary: 'ATS match score for a resume against a job, using the caller’s own AI key' })
  @ApiHeader({
    name: AI_HEADERS.PROVIDER,
    required: true,
    description: `AI vendor: ${Object.values(AiProvider).join(' | ')}`,
  })
  @ApiHeader({
    name: AI_HEADERS.API_KEY,
    required: true,
    description: 'The caller’s own provider API key. Never stored or logged.',
  })
  @ApiHeader({
    name: AI_HEADERS.MODEL,
    required: false,
    description: 'Model id override; the provider default is used when omitted.',
  })
  scoreAts(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AtsScoreRequestDto,
    @AiCredentialsHeaders() credentials: AiCredentials,
  ) {
    return this.resumesService.scoreAts(user, dto.resumeId, dto.jobId, credentials, {
      force: dto.force,
    });
  }

  @Get(':resumeId/ats-score/:jobId')
  @ApiOperation({ summary: 'Stored ATS score for one resume against one job' })
  findAtsScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('resumeId', ParseUUIDPipe) resumeId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.resumesService.findAtsScore(user.id, resumeId, jobId);
  }
}
