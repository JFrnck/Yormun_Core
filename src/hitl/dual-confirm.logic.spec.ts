import { describe, expect, it } from 'vitest';
import {
  canAcceptSecondApproval,
  computeAvailableAt,
} from './dual-confirm.logic';

describe('computeAvailableAt', () => {
  it('suma exactamente 30s a la primera aprobación', () => {
    const first = new Date('2026-01-01T00:00:00.000Z');
    expect(computeAvailableAt(first).toISOString()).toBe(
      '2026-01-01T00:00:30.000Z',
    );
  });
});

describe('canAcceptSecondApproval', () => {
  const availableAt = new Date('2026-01-01T00:00:30.000Z');

  it('rechaza 1ms antes de cumplirse los 30s', () => {
    expect(
      canAcceptSecondApproval(
        availableAt,
        new Date('2026-01-01T00:00:29.999Z'),
      ),
    ).toBe(false);
  });

  it('acepta exactamente al cumplirse los 30s', () => {
    expect(canAcceptSecondApproval(availableAt, availableAt)).toBe(true);
  });

  it('acepta después de los 30s', () => {
    expect(
      canAcceptSecondApproval(
        availableAt,
        new Date('2026-01-01T00:05:00.000Z'),
      ),
    ).toBe(true);
  });
});
