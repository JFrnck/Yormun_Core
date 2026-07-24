import { describe, expect, it } from 'vitest';
import type { ModelPrices } from '../model-provider/model-provider.types';
import { computeCostUsd, estimateTokens } from './cost';

describe('estimateTokens', () => {
  it('estima ~1 token cada 4 caracteres', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('redondea hacia arriba para no subestimar', () => {
    expect(estimateTokens('abc')).toBe(1);
  });

  it('texto vacío estima 0 tokens', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('computeCostUsd', () => {
  const prices: ModelPrices = {
    'claude-sonnet-5': { inputPerMillion: 3, outputPerMillion: 15 },
  };

  it('calcula el costo combinando input y output al precio por millón', () => {
    const cost = computeCostUsd(prices, 'claude-sonnet-5', 1_000_000, 500_000);
    // 1M input a $3/M = $3; 500k output a $15/M = $7.50
    expect(cost).toBeCloseTo(10.5, 6);
  });

  it('con 0 tokens el costo es 0', () => {
    expect(computeCostUsd(prices, 'claude-sonnet-5', 0, 0)).toBe(0);
  });

  it('lanza si el modelId no tiene precio configurado', () => {
    expect(() =>
      computeCostUsd(prices, 'modelo-inexistente', 100, 100),
    ).toThrow(/No hay precio configurado/);
  });
});
