import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Update } from 'grammy/types';
import { TelegramBotService } from './telegram-bot.service';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Endpoint del Webhook de Telegram' })
  @ApiHeader({
    name: 'x-telegram-bot-api-secret-token',
    required: false,
    description: 'Secret token configurado en setWebhook de Telegram',
  })
  @ApiResponse({ status: 200, description: 'Update procesado correctamente' })
  @ApiResponse({ status: 401, description: 'Secret token no válido' })
  async handleWebhook(
    @Body() update: Update,
    @Headers('x-telegram-bot-api-secret-token') secretHeader?: string,
  ): Promise<void> {
    if (!this.telegramBotService.validateWebhookSecret(secretHeader)) {
      throw new UnauthorizedException('Secret token de Telegram no válido');
    }
    await this.telegramBotService.handleWebhookUpdate(update);
  }
}
