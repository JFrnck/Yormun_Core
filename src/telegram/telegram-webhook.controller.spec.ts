import { UnauthorizedException } from '@nestjs/common';
import type { Update } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramBotService } from './telegram-bot.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

describe('TelegramWebhookController', () => {
  let controller: TelegramWebhookController;
  let mockTelegramBotService: Partial<TelegramBotService>;

  const SECRET_TOKEN = 'ci-fake-secret';

  beforeEach(() => {
    mockTelegramBotService = {
      validateWebhookSecret: vi
        .fn()
        .mockImplementation((header?: string) => header === SECRET_TOKEN),
      handleWebhookUpdate: vi.fn().mockResolvedValue(undefined),
    };

    controller = new TelegramWebhookController(
      mockTelegramBotService as TelegramBotService,
    );
  });

  const validUpdate: Update = {
    update_id: 123,
    message: {
      message_id: 123,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 123456789, type: 'private', first_name: 'Owner' },
      from: { id: 123456789, first_name: 'Owner', is_bot: false },
      text: '/start',
      entities: [{ type: 'bot_command', offset: 0, length: 6 }],
    },
  };

  it('debe procesar el update si el secret token es válido', async () => {
    await controller.handleWebhook(validUpdate, SECRET_TOKEN);
    expect(mockTelegramBotService.handleWebhookUpdate).toHaveBeenCalledWith(
      validUpdate,
    );
  });

  it('debe lanzar UnauthorizedException si el secret token no es válido', async () => {
    await expect(
      controller.handleWebhook(validUpdate, 'wrong-secret'),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockTelegramBotService.handleWebhookUpdate).not.toHaveBeenCalled();
  });
});
