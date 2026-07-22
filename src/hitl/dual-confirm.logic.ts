// BLUEPRINT 9.2: la segunda aprobación de un dual-confirm no se acepta
// antes de este delay, para evitar el "apruebo todo por reflejo".
export const DUAL_CONFIRM_DELAY_MS = 30_000;

export function computeAvailableAt(firstApprovedAt: Date): Date {
  return new Date(firstApprovedAt.getTime() + DUAL_CONFIRM_DELAY_MS);
}

export function canAcceptSecondApproval(availableAt: Date, now: Date): boolean {
  return now.getTime() >= availableAt.getTime();
}
