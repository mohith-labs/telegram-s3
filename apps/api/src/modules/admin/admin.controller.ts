import { Body, Controller, Post, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { LoginDto } from './dto/login.dto';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.adminService.login(dto.username, dto.password);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  async me() {
    return { authenticated: true };
  }
}
