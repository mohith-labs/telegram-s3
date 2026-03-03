import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ObjectsService } from './objects.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@Controller('objects')
@UseGuards(AdminAuthGuard)
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Get('stats')
  async getStats() {
    return this.objectsService.getStats();
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
  async uploadObject(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.objectsService.putObject(
      bucket,
      key || file.originalname,
      file.buffer,
      file.mimetype,
    );
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
