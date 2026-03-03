import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ObjectsService } from './objects.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { randomBytes } from 'crypto';

// In-memory upload progress tracker
const uploadProgress = new Map<
  string,
  { phase: string; percent: number; error?: string; result?: any }
>();

@Controller('objects')
@UseGuards(AdminAuthGuard)
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Get('stats')
  async getStats() {
    return this.objectsService.getStats();
  }

  @Get('upload-progress/:id')
  getUploadProgress(@Param('id') id: string) {
    const progress = uploadProgress.get(id);
    if (!progress) return { phase: 'unknown', percent: 0 };
    // Clean up completed/failed entries after reading
    if (progress.phase === 'done' || progress.phase === 'error') {
      uploadProgress.delete(id);
    }
    return progress;
  }

  @Get(':bucket')
  async listObjects(
    @Param('bucket') bucket: string,
    @Query('prefix') prefix: string = '',
    @Query('delimiter') delimiter: string = '/',
    @Query('maxKeys') maxKeys: string = '1000',
  ) {
    return this.objectsService.listObjects(
      bucket,
      prefix,
      delimiter,
      parseInt(maxKeys),
    );
  }

  @Post(':bucket/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 * 1024 } }))
  uploadObject(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const uploadId = randomBytes(8).toString('hex');
    uploadProgress.set(uploadId, { phase: 'uploading', percent: 0 });

    // Start upload in background — client polls progress endpoint
    this.objectsService
      .putObject(
        bucket,
        key || file.originalname,
        file.buffer,
        file.mimetype || 'application/octet-stream',
        {},
        (percent) => {
          uploadProgress.set(uploadId, { phase: 'uploading', percent });
        },
      )
      .then((result) => {
        uploadProgress.set(uploadId, {
          phase: 'done',
          percent: 100,
          result,
        });
      })
      .catch((error) => {
        uploadProgress.set(uploadId, {
          phase: 'error',
          percent: 0,
          error: error.message,
        });
      });

    return { uploadId };
  }

  @Get(':bucket/download/*key')
  async downloadObject(
    @Param('bucket') bucket: string,
    @Param('key') key: string,
    @Res() res: Response,
  ) {
    const obj = await this.objectsService.getObject(bucket, key);
    const filename = key.split('/').pop() || key;
    res.set({
      'Content-Type': obj.contentType,
      'Content-Length': obj.size,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res.send(obj.body);
  }

  @Delete(':bucket/*key')
  async deleteObject(
    @Param('bucket') bucket: string,
    @Param('key') key: string,
  ) {
    await this.objectsService.deleteObject(bucket, key);
    return { deleted: true };
  }
}
