import { describe, expect, it } from 'vitest';
import {
  DailyBudgetExceededError,
  KillSwitchActiveError,
  SessionBudgetExceededError,
} from './errors';

describe('SessionBudgetExceededError', () => {
  it('trae el requestId de la sesión en el mensaje y code/httpStatus estables', () => {
    const error = new SessionBudgetExceededError('sess-123');
    expect(error.message).toContain('sess-123');
    expect(error.code).toBe('BUDGET_SESSION_EXCEEDED');
    expect(error.httpStatus).toBe(429);
  });
});

describe('DailyBudgetExceededError', () => {
  it('code/httpStatus estables', () => {
    const error = new DailyBudgetExceededError();
    expect(error.code).toBe('BUDGET_DAILY_EXCEEDED');
    expect(error.httpStatus).toBe(429);
  });
});

describe('KillSwitchActiveError', () => {
  it('incluye la razón en el mensaje, code/httpStatus estables', () => {
    const error = new KillSwitchActiveError('consumo 3x el promedio');
    expect(error.message).toContain('consumo 3x el promedio');
    expect(error.code).toBe('BUDGET_KILL_SWITCH_ACTIVE');
    expect(error.httpStatus).toBe(503);
  });
});
