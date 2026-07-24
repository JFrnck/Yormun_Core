import type { ConfigService } from '@nestjs/config';
import type { Update, UserFromGetMe } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { Env } from '../config/env.schema';
import type { Db } from '../db/db.module';
import {
  DualConfirmService,
  SecondApprovalTooEarlyError,
} from '../hitl/dual-confirm.service';
import type { ModelRouterService } from '../model-provider/router.service';
import { TelegramBotService } from './telegram-bot.service';

describe('TelegramBotService', () => {
  let service: TelegramBotService;
  let mockConfigService: Partial<ConfigService<Env, true>>;
  let mockModelRouter: Partial<ModelRouterService>;
  let mockDualConfirm: Partial<DualConfirmService>;
  let mockAuditService: Partial<AuditService>;
  let mockDb: Partial<Db>;

  const OWNER_CHAT_ID = 123456789;
  const OTHER_CHAT_ID = 987654321;
  const SECRET_TOKEN = 'test-secret-token';

  const mockBotUser: UserFromGetMe = {
    id: 1000,
    is_bot: true,
    first_name: 'YormunBot',
    username: 'yormun_bot',
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };

  beforeEach(async () => {
    mockConfigService = {
      get: (key: keyof Env) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return 'test-bot-token';
        if (key === 'TELEGRAM_OWNER_CHAT_ID') return OWNER_CHAT_ID;
        if (key === 'TELEGRAM_WEBHOOK_URL')
          return 'https://yormun.test/telegram/webhook';
        if (key === 'TELEGRAM_WEBHOOK_SECRET') return SECRET_TOKEN;
        return undefined;
      },
    };

    mockModelRouter = {
      complete: vi.fn().mockResolvedValue({
        content: 'Hola owner, respuesta del LLM',
        modelId: 'claude-sonnet-5',
        inputTokens: 10,
        outputTokens: 10,
      }),
    };

    mockDualConfirm = {
      getPending: vi.fn(),
      recordApproval: vi.fn(),
      removePending: vi.fn().mockResolvedValue(undefined),
    };

    mockAuditService = {
      recordApproval: vi.fn().mockResolvedValue(undefined),
      recordRejection: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([
          {
            requestId: 'test-req-1',
            toolName: 'gitPush',
            level: 'confirm',
            inputsHash: 'abc123hash',
            planSummary: 'Push to main',
            createdAt: new Date(),
          },
        ]),
      }),
    };

    service = new TelegramBotService(
      mockConfigService as ConfigService<Env, true>,
      mockModelRouter as ModelRouterService,
      mockDualConfirm as DualConfirmService,
      mockAuditService as AuditService,
      mockDb as Db,
    );

    // Mock API calls for getMe and setWebhook
    service.getBot().api.config.use((_prev, method) => {
      if (method === 'getMe') {
        return Promise.resolve({
          ok: true,
          result: mockBotUser,
        } as never);
      }
      return Promise.resolve({
        ok: true,
        result: true,
      } as never);
    });

    await service.onModuleInit();
  });

  function createCommandUpdate(updateId: number, text: string): Update {
    const parts = text.split(' ');
    const cmd = parts[0] ?? text;
    return {
      update_id: updateId,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: OWNER_CHAT_ID, type: 'private', first_name: 'Owner' },
        from: { id: OWNER_CHAT_ID, first_name: 'Owner', is_bot: false },
        text,
        entities: [{ type: 'bot_command', offset: 0, length: cmd.length }],
      },
    };
  }

  function mockSendMessage(sentMessages: string[]): void {
    service.getBot().api.config.use((_prev, method, payload) => {
      if (
        method === 'sendMessage' &&
        payload &&
        typeof payload === 'object' &&
        'text' in payload
      ) {
        sentMessages.push(String((payload as { text: string }).text));
      }
      if (method === 'getMe') {
        return Promise.resolve({
          ok: true,
          result: mockBotUser,
        } as never);
      }
      return Promise.resolve({
        ok: true,
        result: true,
      } as never);
    });
  }

  it('debe validar el secret token del webhook correctamente', () => {
    expect(service.validateWebhookSecret(SECRET_TOKEN)).toBe(true);
    expect(service.validateWebhookSecret('wrong-secret')).toBe(false);
    expect(service.validateWebhookSecret(undefined)).toBe(false);
  });

  it('debe descartar mensajes que no provengan del TELEGRAM_OWNER_CHAT_ID', async () => {
    const handleUpdateSpy = vi.spyOn(service.getBot(), 'handleUpdate');
    const update: Update = {
      update_id: 1,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: OTHER_CHAT_ID, type: 'private', first_name: 'Intruder' },
        from: { id: OTHER_CHAT_ID, first_name: 'Intruder', is_bot: false },
        text: '/start',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    };

    await service.handleWebhookUpdate(update);
    expect(handleUpdateSpy).toHaveBeenCalledWith(update);
    expect(mockModelRouter.complete).not.toHaveBeenCalled();
  });

  it('debe procesar el comando /start si proviene del owner', async () => {
    const sentMessages: string[] = [];
    mockSendMessage(sentMessages);

    await service.handleWebhookUpdate(createCommandUpdate(2, '/start'));
    expect(sentMessages.some((msg) => msg.includes('YORMUNGANDER'))).toBe(true);
  });

  it('debe responder el stub informativo al ejecutar /budget', async () => {
    const sentMessages: string[] = [];
    mockSendMessage(sentMessages);

    await service.handleWebhookUpdate(createCommandUpdate(3, '/budget'));
    expect(sentMessages.some((msg) => msg.includes('Budget Guard'))).toBe(true);
  });

  it('debe listar tareas pendientes al recibir /tasks', async () => {
    const sentMessages: string[] = [];
    mockSendMessage(sentMessages);

    await service.handleWebhookUpdate(createCommandUpdate(4, '/tasks'));
    expect(sentMessages.some((msg) => msg.includes('test-req-1'))).toBe(true);
  });

  it('debe procesar /approve y registrar auditoría', async () => {
    const sentMessages: string[] = [];
    mockSendMessage(sentMessages);

    vi.mocked(mockDualConfirm.getPending!).mockResolvedValue({
      requestId: 'test-req-1',
      toolName: 'gitPush',
      level: 'confirm',
      inputsHash: 'abc123hash',
      planSummary: 'Push to main',
      createdAt: new Date(),
      firstApprovedAt: null,
      firstApprover: null,
      availableAt: null,
      escalatedAt: null,
    });
    vi.mocked(mockDualConfirm.recordApproval!).mockResolvedValue('resolved');

    await service.handleWebhookUpdate(
      createCommandUpdate(5, '/approve test-req-1'),
    );

    expect(mockDualConfirm.recordApproval).toHaveBeenCalledWith(
      'test-req-1',
      'owner',
    );
    expect(mockAuditService.recordApproval).toHaveBeenCalledWith({
      requestId: 'test-req-1',
      approver: 'owner',
      toolName: 'gitPush',
      inputsHash: 'abc123hash',
    });
    expect(mockDualConfirm.removePending).toHaveBeenCalledWith('test-req-1');
    expect(sentMessages.some((msg) => msg.includes('Acción Aprobada'))).toBe(
      true,
    );
  });

  it('debe capturar SecondApprovalTooEarlyError si la aprobación en dual-confirm es muy rápida', async () => {
    const sentMessages: string[] = [];
    mockSendMessage(sentMessages);

    vi.mocked(mockDualConfirm.getPending!).mockResolvedValue({
      requestId: 'test-req-dual',
      toolName: 'dropDatabase',
      level: 'dual-confirm',
      inputsHash: 'def456hash',
      planSummary: 'Drop database',
      createdAt: new Date(),
      firstApprovedAt: new Date(),
      firstApprover: 'owner',
      availableAt: new Date(Date.now() + 25000),
      escalatedAt: null,
    });
    vi.mocked(mockDualConfirm.recordApproval!).mockRejectedValue(
      new SecondApprovalTooEarlyError(
        'test-req-dual',
        new Date(Date.now() + 25000),
      ),
    );

    await service.handleWebhookUpdate(
      createCommandUpdate(6, '/approve test-req-dual'),
    );
    expect(
      sentMessages.some((msg) =>
        msg.includes(
          'La segunda aprobación de "test-req-dual" no se acepta antes de',
        ),
      ),
    ).toBe(true);
  });

  it('debe responder usando ModelRouterService al recibir texto libre', async () => {
    const sentMessages: string[] = [];
    mockSendMessage(sentMessages);

    const update: Update = {
      update_id: 7,
      message: {
        message_id: 7,
        date: Math.floor(Date.now() / 1000),
        chat: { id: OWNER_CHAT_ID, type: 'private', first_name: 'Owner' },
        from: { id: OWNER_CHAT_ID, first_name: 'Owner', is_bot: false },
        text: 'Hola Yormun, ¿cómo estás?',
      },
    };

    await service.handleWebhookUpdate(update);
    expect(mockModelRouter.complete).toHaveBeenCalledWith(
      'chat_conversational',
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Hola Yormun, ¿cómo estás?' }],
        maxOutputTokens: 2000,
        temperature: 0.7,
      }),
    );
    expect(sentMessages).toContain('Hola owner, respuesta del LLM');
  });
});
