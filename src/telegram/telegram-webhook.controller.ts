import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Update } from 'grammy/types';
import { TelegramBotService } from './telegram-bot.service';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Endpoint del Webhook de Telegram' })
  @ApiResponse({ status: 200, description: 'Update procesado correctamente' })
  async handleWebhook(@Body() update: Update): Promise<void> {
    await this.telegramBotService.handleWebhookUpdate(update);
  }
}
