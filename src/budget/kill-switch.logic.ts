import type { BudgetConfig } from './budget.types';

export interface HourlyUsage {
  readonly hourBucket: Date;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * `true` si el consumo de la hora actual es "runaway" respecto al
 * promedio de las horas anteriores dentro de la ventana de lookback
 * (BLUEPRINT 9.6: "si en 1 hora se consumen >2× de lo consumido en las
 * 24h previas"). Interpretación explícita (el blueprint no lo desambigua
 * más): se compara contra el PROMEDIO por hora de las últimas
 * `runawayLookbackHours`, no contra el total crudo — comparar 1h contra
 * un total de 24h directamente no tendría sentido como detector de tasa.
 * Sin filas de lookback (arranque en frío, servicio recién desplegado)
 * no hay base de comparación → nunca dispara falsos positivos por falta
 * de historial.
 */
export function isRunawayDetected(
  currentHourUsage: number,
  lookbackHours: readonly HourlyUsage[],
  config: BudgetConfig,
): boolean {
  if (lookbackHours.length === 0) {
    return false;
  }

  const lookbackTotal = lookbackHours.reduce(
    (sum, hour) => sum + hour.inputTokens + hour.outputTokens,
    0,
  );
  const avgHourlyUsage = lookbackTotal / config.runawayLookbackHours;

  if (avgHourlyUsage <= 0) {
    return false;
  }

  return currentHourUsage > avgHourlyUsage * config.runawayMultiplier;
}
