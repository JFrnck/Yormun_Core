import { describe, expect, it } from 'vitest';
import { currentHourBucket, todayLocalDate } from './budget-time';

describe('todayLocalDate', () => {
  it('formatea año-mes-día con ceros a la izquierda', () => {
    expect(todayLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('usa la hora local, no UTC', () => {
    expect(todayLocalDate(new Date(2026, 6, 23, 0, 0, 0))).toBe('2026-07-23');
  });
});

describe('currentHourBucket', () => {
  it('trunca minutos, segundos y milisegundos', () => {
    const bucket = currentHourBucket(new Date(2026, 6, 23, 14, 37, 22, 500));
    expect(bucket).toEqual(new Date(2026, 6, 23, 14, 0, 0, 0));
  });
});
