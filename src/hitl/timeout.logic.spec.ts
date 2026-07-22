import { describe, expect, it } from 'vitest';
import { decideTimeoutOutcome } from './timeout.logic';

const HOUR = 60 * 60 * 1000;
const START = new Date('2026-01-01T00:00:00.000Z');
const at = (hoursLater: number) =>
  new Date(START.getTime() + hoursLater * HOUR);

describe('decideTimeoutOutcome — timeoutBehavior "discard"', () => {
  it('no hace nada antes de las 24h', () => {
    expect(
      decideTimeoutOutcome({
        createdAt: START,
        timeoutBehavior: 'discard',
        alreadyEscalated: false,
        now: at(23.9),
      }),
    ).toEqual({ action: 'none' });
  });

  it('descarta exactamente a las 24h', () => {
    expect(
      decideTimeoutOutcome({
        createdAt: START,
        timeoutBehavior: 'discard',
        alreadyEscalated: false,
        now: at(24),
      }),
    ).toEqual({ action: 'discard' });
  });
});

describe('decideTimeoutOutcome — timeoutBehavior "escalate"', () => {
  it('no hace nada antes de las 12h', () => {
    expect(
      decideTimeoutOutcome({
        createdAt: START,
        timeoutBehavior: 'escalate',
        alreadyEscalated: false,
        now: at(11.9),
      }),
    ).toEqual({ action: 'none' });
  });

  it('escala exactamente a las 12h si no se había escalado antes', () => {
    expect(
      decideTimeoutOutcome({
        createdAt: START,
        timeoutBehavior: 'escalate',
        alreadyEscalated: false,
        now: at(12),
      }),
    ).toEqual({ action: 'escalate-warning' });
  });

  it('no re-escala si ya se había avisado (evita spam en cada barrido)', () => {
    expect(
      decideTimeoutOutcome({
        createdAt: START,
        timeoutBehavior: 'escalate',
        alreadyEscalated: true,
        now: at(15),
      }),
    ).toEqual({ action: 'none' });
  });

  it('abandona exactamente a las 24h', () => {
    expect(
      decideTimeoutOutcome({
        createdAt: START,
        timeoutBehavior: 'escalate',
        alreadyEscalated: true,
        now: at(24),
      }),
    ).toEqual({ action: 'abandon' });
  });

  it('abandona a las 24h aunque nunca se haya escalado (el timeout nunca aprueba, regla de oro #9)', () => {
    expect(
      decideTimeoutOutcome({
        createdAt: START,
        timeoutBehavior: 'escalate',
        alreadyEscalated: false,
        now: at(24),
      }),
    ).toEqual({ action: 'abandon' });
  });
});
