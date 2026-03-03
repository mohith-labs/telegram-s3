import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';

@Controller('telegram')
@UseGuards(AdminAuthGuard)
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('status')
  async getStatus() {
    return this.telegramService.getStatus();
  }

  @Post('send-code')
  async sendCode(@Body() dto: SendCodeDto) {
    return this.telegramService.sendCode(dto.apiId, dto.apiHash, dto.phoneNumber);
  }

  @Post('verify-code')
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.telegramService.verifyCode(
      dto.phoneNumber,
      dto.code,
      dto.phoneCodeHash,
    );
  }

  @Post('verify-2fa')
  async verify2FA(@Body() dto: Verify2FADto) {
    return this.telegramService.verify2FA(dto.password);
  }

  @Delete('disconnect')
  async disconnect() {
    return this.telegramService.disconnect();
  }
}
