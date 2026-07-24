import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramBotService } from './telegram-bot.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

describe('TelegramWebhookController', () => {
  let controller: TelegramWebhookController;
  let mockTelegramBotService: Partial<TelegramBotService>;

  beforeEach(() => {
    mockTelegramBotService = {
      handleWebhookUpdate: vi.fn().mockResolvedValue(undefined),
    };

    controller = new TelegramWebhookController(
      mockTelegramBotService as TelegramBotService,
    );
  });

  it('debe recibir la petición del webhook y enviarla al servicio', async () => {
    const updatePayload = { update_id: 123, message: { text: '/start' } };
    await controller.handleWebhook(updatePayload);

    expect(mockTelegramBotService.handleWebhookUpdate).toHaveBeenCalledWith(
      updatePayload,
    );
  });
});
