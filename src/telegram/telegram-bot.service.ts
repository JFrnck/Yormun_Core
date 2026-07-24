import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard, type Context } from 'grammy';
import type { Update } from 'grammy/types';
import { AuditService } from '../audit/audit.service';
import type { Env } from '../config/env.schema';
import { DB_CONNECTION, type Db } from '../db/db.module';
import { pendingApprovals } from '../db/schema';
import {
  DualConfirmService,
  PendingApprovalNotFoundError,
  SecondApprovalTooEarlyError,
} from '../hitl/dual-confirm.service';
import { ModelRouterService } from '../model-provider/router.service';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly bot: Bot;
  private readonly ownerChatId: number;
  private readonly webhookUrl?: string;
  private readonly webhookSecret?: string;

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly modelRouterService: ModelRouterService,
    private readonly dualConfirmService: DualConfirmService,
    private readonly auditService: AuditService,
    @Inject(DB_CONNECTION) private readonly db: Db,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.ownerChatId = this.configService.get<number>('TELEGRAM_OWNER_CHAT_ID');
    this.webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL', {
      infer: true,
    });
    this.webhookSecret = this.configService.get<string>(
      'TELEGRAM_WEBHOOK_SECRET',
      { infer: true },
    );

    this.bot = new Bot(token);
    this.setupMiddleware();
    this.setupHandlers();
  }

  async onModuleInit(): Promise<void> {
    try {
      if (!this.bot.isInited()) {
        await this.bot.init();
        this.logger.log(
          `Bot de Telegram inicializado como @${this.bot.botInfo.username}`,
        );
      }

      if (this.webhookUrl) {
        const options = this.webhookSecret
          ? { secret_token: this.webhookSecret }
          : undefined;
        await this.bot.api.setWebhook(this.webhookUrl, options);
        this.logger.log(
          `Webhook de Telegram configurado en: ${this.webhookUrl} ${
            this.webhookSecret ? '(con secret_token)' : ''
          }`,
        );
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Error al inicializar/configurar bot de Telegram: ${errorMsg}`,
      );
    }
  }

  public getBot(): Bot {
    return this.bot;
  }

  /**
   * Valida si el secret token recibido en los headers del webhook coincide
   * con el secret configurado en las variables de entorno.
   */
  public validateWebhookSecret(secretTokenHeader?: string): boolean {
    if (!this.webhookSecret) {
      return true; // En entornos donde no se define secret, se permite
    }
    return secretTokenHeader === this.webhookSecret;
  }

  public async handleWebhookUpdate(update: Update): Promise<void> {
    await this.bot.handleUpdate(update);
  }

  private setupMiddleware(): void {
    // Middleware de autenticación estricta: ignora cualquier mensaje que no venga del owner
    this.bot.use(async (ctx: Context, next) => {
      if (ctx.chat?.id !== this.ownerChatId) {
        this.logger.warn(
          `Intento de acceso no autorizado desde chat_id ${ctx.chat?.id}`,
        );
        return;
      }
      await next();
    });
  }

  private setupHandlers(): void {
    // Comando /start
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '🤖 *YORMUNGANDER* — Orquestador de Agentes Personal\n\nSistema activo y listo para procesar instrucciones.',
        { parse_mode: 'Markdown' },
      );
    });

    // Comando /status
    this.bot.command('status', async (ctx) => {
      await ctx.reply(
        '✅ *Estado del Sistema*\n\n' +
          '- *yormun-core*: En línea\n' +
          '- *Base de Datos*: Conectada (Postgres + pgvector)\n' +
          '- *Modo Webhook*: Activo',
        { parse_mode: 'Markdown' },
      );
    });

    // Comando /tasks
    this.bot.command('tasks', async (ctx) => {
      await this.handleTasksCommand(ctx);
    });

    // Comando /approve <requestId>
    this.bot.command('approve', async (ctx) => {
      const requestId = ctx.match?.trim();
      if (!requestId) {
        await ctx.reply('⚠️ Uso: `/approve <id>`', { parse_mode: 'Markdown' });
        return;
      }
      await this.processApproval(ctx, requestId);
    });

    // Comando /reject <requestId>
    this.bot.command('reject', async (ctx) => {
      const requestId = ctx.match?.trim();
      if (!requestId) {
        await ctx.reply('⚠️ Uso: `/reject <id>`', { parse_mode: 'Markdown' });
        return;
      }
      await this.processRejection(ctx, requestId);
    });

    // Comando /budget (stub honesto para Fase 4.1)
    this.bot.command('budget', async (ctx) => {
      await ctx.reply(
        'ℹ️ El sistema de control de presupuesto (Budget Guard) está pendiente de implementación (Fase 4.1).',
      );
    });

    // Handler para botones inline CallbackQuery
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const [action, requestId] = data.split(':');

      if (!requestId) {
        await ctx.answerCallbackQuery({ text: 'Acción no válida' });
        return;
      }

      if (action === 'approve') {
        await ctx.answerCallbackQuery();
        await this.processApproval(ctx, requestId);
      } else if (action === 'reject') {
        await ctx.answerCallbackQuery();
        await this.processRejection(ctx, requestId);
      } else if (action === 'details') {
        await ctx.answerCallbackQuery();
        await this.showTaskDetails(ctx, requestId);
      }
    });

    // Handler de mensajes de texto libre (conversacional vía ModelRouterService)
    this.bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) {
        return; // Ya procesado por los command handlers
      }

      try {
        const response = await this.modelRouterService.complete(
          'chat_conversational',
          {
            systemPrompt:
              'Eres Yormun, un orquestador de agentes inteligente y conciso.',
            messages: [{ role: 'user', content: text }],
            maxOutputTokens: 2000,
            temperature: 0.7,
          },
        );

        await ctx.reply(response.content);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error en respuesta conversacional: ${msg}`);
        await ctx.reply(
          '⚠️ Ocurrió un error al procesar el mensaje con el LLM.',
        );
      }
    });
  }

  private async handleTasksCommand(ctx: Context): Promise<void> {
    const pendingList = await this.db.select().from(pendingApprovals);

    if (pendingList.length === 0) {
      await ctx.reply('🎉 No hay aprobaciones pendientes.');
      return;
    }

    await ctx.reply(`📋 *Aprobaciones Pendientes (${pendingList.length})*:`, {
      parse_mode: 'Markdown',
    });

    for (const item of pendingList) {
      const keyboard = new InlineKeyboard()
        .text('✅ Aprobar', `approve:${item.requestId}`)
        .text('❌ Rechazar', `reject:${item.requestId}`)
        .row()
        .text('🔍 Ver detalles', `details:${item.requestId}`);

      const text =
        `📌 *Solicitud*: \`${item.requestId}\`\n` +
        `- *Herramienta*: \`${item.toolName}\`\n` +
        `- *Nivel HITL*: \`${item.level}\`\n` +
        `- *Plan*: ${item.planSummary ?? 'Sin resumen'}`;

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }

  private async processApproval(
    ctx: Context,
    requestId: string,
  ): Promise<void> {
    try {
      const pending = await this.dualConfirmService.getPending(requestId);
      if (!pending) {
        await ctx.reply(
          `❌ No se encontró ninguna aprobación pendiente con ID \`${requestId}\`.`,
          {
            parse_mode: 'Markdown',
          },
        );
        return;
      }

      const outcome = await this.dualConfirmService.recordApproval(
        requestId,
        'owner',
      );

      if (outcome === 'awaiting-second') {
        await ctx.reply(
          `⏳ *Primera aprobación registrada* para \`${requestId}\`.\n` +
            `Por favor, envíe la segunda aprobación pasados 30 segundos.`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      await this.auditService.recordApproval({
        requestId,
        approver: 'owner',
        toolName: pending.toolName,
        inputsHash: pending.inputsHash,
      });

      await this.dualConfirmService.removePending(requestId);

      await ctx.reply(
        `✅ *Acción Aprobada* (\`${requestId}\`). Registrado en audit log.`,
        {
          parse_mode: 'Markdown',
        },
      );
    } catch (err: unknown) {
      if (err instanceof SecondApprovalTooEarlyError) {
        await ctx.reply(`⚠️ ${err.message}`);
        return;
      }
      if (err instanceof PendingApprovalNotFoundError) {
        await ctx.reply(`❌ ${err.message}`);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`⚠️ Error al procesar aprobación: ${msg}`);
    }
  }

  private async processRejection(
    ctx: Context,
    requestId: string,
  ): Promise<void> {
    try {
      const pending = await this.dualConfirmService.getPending(requestId);
      if (!pending) {
        await ctx.reply(
          `❌ No se encontró ninguna aprobación pendiente con ID \`${requestId}\`.`,
          {
            parse_mode: 'Markdown',
          },
        );
        return;
      }

      await this.auditService.recordRejection({
        requestId,
        approver: 'owner',
        toolName: pending.toolName,
        inputsHash: pending.inputsHash,
      });

      await this.dualConfirmService.removePending(requestId);

      await ctx.reply(
        `❌ *Acción Rechazada* (\`${requestId}\`). Registrado en audit log.`,
        {
          parse_mode: 'Markdown',
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`⚠️ Error al procesar rechazo: ${msg}`);
    }
  }

  private async showTaskDetails(
    ctx: Context,
    requestId: string,
  ): Promise<void> {
    const pending = await this.dualConfirmService.getPending(requestId);
    if (!pending) {
      await ctx.reply(`❌ No se encontró la tarea \`${requestId}\`.`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    const details =
      `🔍 *Detalles de Aprobación Pendiente*\n\n` +
      `- *ID*: \`${pending.requestId}\`\n` +
      `- *Herramienta*: \`${pending.toolName}\`\n` +
      `- *Nivel HITL*: \`${pending.level}\`\n` +
      `- *Hash Inputs*: \`${pending.inputsHash}\`\n` +
      `- *Plan*: ${pending.planSummary ?? 'Sin plan summary'}\n` +
      `- *Creado*: \`${pending.createdAt.toISOString()}\`\n` +
      (pending.firstApprovedAt
        ? `- *1ª Aprobación*: \`${pending.firstApprovedAt.toISOString()}\` por \`${pending.firstApprover}\`\n`
        : '');

    await ctx.reply(details, { parse_mode: 'Markdown' });
  }
}
