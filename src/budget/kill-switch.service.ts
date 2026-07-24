import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { and, eq, gte, lt } from 'drizzle-orm';
import type { Counter } from 'prom-client';
import { DB_CONNECTION, type Db } from '../db/db.module';
import { budgetHourlyUsage, budgetKillSwitch } from '../db/schema';
import { RUNAWAY_DETECTED_TOTAL } from '../metrics/metrics.module';
import { currentHourBucket } from './budget-time';
import { BUDGET_CONFIG } from './budget.tokens';
import type { BudgetConfig } from './budget.types';
import { isRunawayDetected } from './kill-switch.logic';

const KILL_SWITCH_ROW_ID = 1;

/**
 * Kill switch de runaway (BLUEPRINT 9.6). Estado persistido en
 * `budget_kill_switch` (fila singleton, `id` fijo) — a propósito, a
 * diferencia de `ChainVerificationService.locked` (en memoria, gap
 * preexistente ajeno a este módulo): un simple redeploy no debe
 * "despausar" el sistema sin intervención humana, esa es la garantía
 * central del kill switch.
 */
@Injectable()
export class KillSwitchService {
  private readonly logger = new Logger(KillSwitchService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: Db,
    @Inject(BUDGET_CONFIG) private readonly config: BudgetConfig,
    @InjectMetric(RUNAWAY_DETECTED_TOTAL)
    private readonly runawayDetectedCounter: Counter<string>,
  ) {}

  async isActive(): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(budgetKillSwitch)
      .where(eq(budgetKillSwitch.id, KILL_SWITCH_ROW_ID));
    return rows[0]?.active ?? false;
  }

  /**
   * Solo debe llamarse tras una acción humana explícita (BLUEPRINT 9.6:
   * "requiere unpause manual"). No valida eso acá — es responsabilidad
   * del caller (comando `/unpause` de Telegram, autenticado por chat_id
   * whitelisted, ver src/telegram/).
   */
  async unpause(): Promise<void> {
    await this.upsertState({ active: false, activatedAt: null, reason: null });
    this.logger.log('Kill switch desactivado manualmente (/unpause).');
  }

  /**
   * Barrido cada 5 min (más frecuente que el diario de `ChainVerificationService`
   * porque un runaway se detecta y contiene en minutos, no en horas).
   */
  @Cron('*/5 * * * *')
  async checkRunaway(): Promise<void> {
    if (await this.isActive()) {
      return; // ya activo — no hay nada que re-detectar hasta el /unpause
    }

    const currentBucket = currentHourBucket();
    const lookbackStart = new Date(
      currentBucket.getTime() -
        this.config.runawayLookbackHours * 60 * 60 * 1000,
    );

    const [currentRow, lookbackRows] = await Promise.all([
      this.db
        .select()
        .from(budgetHourlyUsage)
        .where(eq(budgetHourlyUsage.hourBucket, currentBucket)),
      this.db
        .select()
        .from(budgetHourlyUsage)
        .where(
          and(
            gte(budgetHourlyUsage.hourBucket, lookbackStart),
            lt(budgetHourlyUsage.hourBucket, currentBucket),
          ),
        ),
    ]);

    const currentUsage =
      (currentRow[0]?.inputTokens ?? 0) + (currentRow[0]?.outputTokens ?? 0);

    if (isRunawayDetected(currentUsage, lookbackRows, this.config)) {
      const reason =
        `Consumo de la hora actual (${currentUsage} tokens) supera ` +
        `${this.config.runawayMultiplier}x el promedio de las últimas ` +
        `${this.config.runawayLookbackHours}h.`;
      await this.upsertState({ active: true, activatedAt: new Date(), reason });
      this.runawayDetectedCounter.inc();
      this.logger.error(`KILL SWITCH ACTIVADO: ${reason}`);
      // Notificación real a Telegram: TelegramBotService la hace vía
      // polling de isActive() (evita import circular entre
      // TelegramModule y BudgetModule — ver STATUS.md Fase 4.1).
    }
  }

  private async upsertState(state: {
    active: boolean;
    activatedAt: Date | null;
    reason: string | null;
  }): Promise<void> {
    await this.db
      .insert(budgetKillSwitch)
      .values({ id: KILL_SWITCH_ROW_ID, ...state })
      .onConflictDoUpdate({
        target: budgetKillSwitch.id,
        set: state,
      });
  }
}
