import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { KeysService } from './keys.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CreateKeyDto } from './dto/create-key.dto';

@Controller('keys')
@UseGuards(AdminAuthGuard)
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Get()
  async list() {
    return this.keysService.list();
  }

  @Post()
  async create(@Body() dto: CreateKeyDto) {
    return this.keysService.create(dto.name, dto.permissions);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; isActive?: boolean; permissions?: Record<string, string[]> },
  ) {
    return this.keysService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.keysService.delete(id);
  }
}
