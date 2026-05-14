import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto';
import { unlink } from 'fs/promises';

type AuthRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audits: AuditService) {}

  @Post()
  create(@Request() req: AuthRequest, @Body() dto: CreateAuditDto) {
    return this.audits.createFromSources(req.user.id, dto);
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 1024 * 1024 * 2, files: 10 },
      fileFilter: (_req, file, cb) => cb(null, extname(file.originalname) === '.sol'),
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR ?? './uploads',
        filename: (_req, file, cb) => cb(null, `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '')}`)
      })
    })
  )
  async upload(@Request() req: AuthRequest, @UploadedFiles() files: Express.Multer.File[], @Body('title') title?: string) {
    if (!files?.length) throw new BadRequestException('Upload at least one .sol file');
    const { readFile } = await import('fs/promises');
    const contracts = await Promise.all(
      files.map(async (file) => {
        const source = await readFile(file.path, 'utf8');
        unlink(file.path).catch(() => undefined);
        return { fileName: file.originalname, source };
      })
    );
    return this.audits.createFromSources(req.user.id, { title: title || files[0].originalname, contracts });
  }

  @Get('history')
  history(@Request() req: AuthRequest) {
    return this.audits.history(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.audits.findForUser(req.user.id, id);
  }
}
