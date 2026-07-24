import { describe, expect, it } from 'vitest';
import type { BudgetConfig } from './budget.types';
import { isRunawayDetected } from './kill-switch.logic';

const CONFIG: BudgetConfig = {
  sessionMaxInputTokens: 500_000,
  sessionMaxOutputTokens: 100_000,
  dailyMaxTokens: 5_000_000,
  dailyMaxUsd: 10,
  runawayMultiplier: 2,
  runawayLookbackHours: 24,
};

function makeHours(tokensPerHour: number, count = 24) {
  return Array.from({ length: count }, (_, i) => ({
    hourBucket: new Date(2026, 0, 1, i),
    inputTokens: tokensPerHour,
    outputTokens: 0,
  }));
}

describe('isRunawayDetected', () => {
  it('false sin historial de lookback (arranque en frío)', () => {
    expect(isRunawayDetected(1_000_000, [], CONFIG)).toBe(false);
  });

  it('false con consumo normal (igual al promedio histórico)', () => {
    const lookback = makeHours(1000); // promedio 1000/h
    expect(isRunawayDetected(1000, lookback, CONFIG)).toBe(false);
  });

  it('false justo por debajo del multiplicador (2x exacto no es ">", es límite)', () => {
    const lookback = makeHours(1000); // promedio 1000/h
    expect(isRunawayDetected(2000, lookback, CONFIG)).toBe(false);
  });

  it('true apenas por encima del multiplicador', () => {
    const lookback = makeHours(1000); // promedio 1000/h
    expect(isRunawayDetected(2001, lookback, CONFIG)).toBe(true);
  });

  it('true con un runaway claro (10x el promedio)', () => {
    const lookback = makeHours(1000);
    expect(isRunawayDetected(10_000, lookback, CONFIG)).toBe(true);
  });

  it('false si el promedio histórico es 0 (nunca hubo consumo — evita división engañosa)', () => {
    const lookback = makeHours(0);
    expect(isRunawayDetected(500, lookback, CONFIG)).toBe(false);
  });

  it('usa runawayLookbackHours de la config, no la cantidad de filas recibidas', () => {
    // Solo 5 filas de historial (no 24) pero runawayLookbackHours=24:
    // el promedio se divide entre 24 igual, no entre 5 — un historial
    // parcial no debe inflar artificialmente el promedio.
    const lookback = makeHours(2400, 5); // total = 12000
    // avgHourlyUsage = 12000/24 = 500, no 12000/5=2400
    expect(isRunawayDetected(1001, lookback, CONFIG)).toBe(true); // 1001 > 500*2
    expect(isRunawayDetected(999, lookback, CONFIG)).toBe(false); // 999 < 1000
  });
});
