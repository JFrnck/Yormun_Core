import type { BudgetConfig } from './budget.types';

export interface DailyUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

export interface SessionUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Ratio 0-1 de presupuesto diario consumido — el mayor entre tokens y
 * USD (BLUEPRINT 9.6: cualquiera de los dos límites puede dispararse
 * primero). >1 es posible (no se clampa acá) — el caller decide qué
 * hacer con el exceso.
 */
export function computeDailyUsageRatio(
  daily: DailyUsage,
  config: BudgetConfig,
): number {
  const tokensRatio =
    (daily.inputTokens + daily.outputTokens) / config.dailyMaxTokens;
  const costRatio = daily.costUsd / config.dailyMaxUsd;
  return Math.max(tokensRatio, costRatio);
}

/**
 * `true` si sumar esta llamada (estimada) al acumulado de la sesión
 * superaría alguno de los dos límites de sesión (BLUEPRINT 9.6). Chequea
 * input Y output por separado — una sesión con mucho input y poco
 * output no debe "compensar" quedándose corta en el otro eje.
 */
export function wouldExceedSessionBudget(
  session: SessionUsage,
  estimatedInputTokens: number,
  maxOutputTokens: number,
  config: BudgetConfig,
): boolean {
  return (
    session.inputTokens + estimatedInputTokens > config.sessionMaxInputTokens ||
    session.outputTokens + maxOutputTokens > config.sessionMaxOutputTokens
  );
}
