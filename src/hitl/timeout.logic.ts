// BLUEPRINT 9.4: TTL default 24h; tools con deadline externo escalan a
// las 12h antes de marcarse 'abandoned' a las 24h. El timeout JAMÁS
// aprueba — solo descarta o escala (regla de oro #9).
export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;
export const ESCALATION_WARNING_MS = 12 * 60 * 60 * 1000;

export type TimeoutOutcome =
  | { action: 'none' }
  | { action: 'discard' }
  | { action: 'escalate-warning' }
  | { action: 'abandon' };

export interface TimeoutDecisionInput {
  createdAt: Date;
  timeoutBehavior: 'discard' | 'escalate';
  /** Si ya se envió el aviso de las 12h — evita re-notificar en cada barrido. */
  alreadyEscalated: boolean;
  now: Date;
}

export function decideTimeoutOutcome(
  input: TimeoutDecisionInput,
): TimeoutOutcome {
  const elapsedMs = input.now.getTime() - input.createdAt.getTime();

  if (input.timeoutBehavior === 'discard') {
    return elapsedMs >= APPROVAL_TTL_MS
      ? { action: 'discard' }
      : { action: 'none' };
  }

  if (elapsedMs >= APPROVAL_TTL_MS) {
    return { action: 'abandon' };
  }
  if (elapsedMs >= ESCALATION_WARNING_MS && !input.alreadyEscalated) {
    return { action: 'escalate-warning' };
  }
  return { action: 'none' };
}
