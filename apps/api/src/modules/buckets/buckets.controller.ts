import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BucketsService } from './buckets.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CreateBucketDto } from './dto/create-bucket.dto';

@Controller('buckets')
@UseGuards(AdminAuthGuard)
export class BucketsController {
  constructor(private readonly bucketsService: BucketsService) {}

  @Get()
  async list() {
    return this.bucketsService.list();
  }

  @Post()
  async create(@Body() dto: CreateBucketDto) {
    return this.bucketsService.create(dto.name);
  }

  @Delete(':name')
  async delete(
    @Param('name') name: string,
    @Query('force') force?: string,
  ) {
    return this.bucketsService.delete(name, force === 'true');
  }
}
