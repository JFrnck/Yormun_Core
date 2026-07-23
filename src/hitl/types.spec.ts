import { describe, expect, it } from 'vitest';
import { approvalsRequiredFor, HITL_LEVELS, HitlLevelSchema } from './types';

describe('approvalsRequiredFor', () => {
  // Matriz completa de los 4 niveles (AGENTS.md 6.1: 100% de cobertura).
  it.each([
    ['auto', 0],
    ['notify', 0],
    ['confirm', 1],
    ['dual-confirm', 2],
  ] as const)('%s requiere %i aprobaciones', (level, expected) => {
    expect(approvalsRequiredFor(level)).toBe(expected);
  });
});

describe('HitlLevelSchema', () => {
  it('acepta exactamente los 4 niveles declarados', () => {
    for (const level of HITL_LEVELS) {
      expect(HitlLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  it('rechaza un nivel inventado', () => {
    expect(HitlLevelSchema.safeParse('super-auto').success).toBe(false);
  });
});
