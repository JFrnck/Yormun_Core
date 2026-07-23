import { UnknownTaskProfileError } from './errors';
import type {
  ModelsConfig,
  SelectModelHints,
  SelectedModel,
  TaskProfile,
} from './model-provider.types';

/**
 * `budgetRemaining` (ratio 0-1) por debajo de este umbral degrada a
 * `fallback` (docs/MODEL_ROUTING.md §2.2: "si estás cerca del límite
 * diario, degrada a modelos más baratos automáticamente" — el doc no fija
 * un número; 0.2 es una decisión propia, ajustable sin tocar callers.
 */
export const LOW_BUDGET_REMAINING_THRESHOLD = 0.2;

/**
 * Selector puro (`docs/MODEL_ROUTING.md` §2.2 — `ModelProvider.selectModel`).
 * No hace ninguna llamada de red: solo decide `primary` vs `fallback`
 * según los hints. El caller (`router.service.ts`) es quien invoca el
 * modelo elegido y maneja el failover real (§2.3) si esa llamada falla.
 */
export function selectModel(
  profiles: ModelsConfig,
  taskProfile: TaskProfile,
  hints: SelectModelHints = {},
): SelectedModel {
  const profile = profiles[taskProfile];
  if (!profile) {
    throw new UnknownTaskProfileError(taskProfile);
  }

  let tier: 'primary' | 'fallback' = 'primary';

  // 1. Contexto: si el input estimado no entra en el límite del primary,
  // no tiene sentido intentarlo — degrada directo.
  if (
    hints.estimatedInputTokens !== undefined &&
    hints.estimatedInputTokens > profile.maxTokensInput
  ) {
    tier = 'fallback';
  }

  // 2. Latencia baja: baja al tier más rápido del profile. En todos los
  // profiles definidos, `fallback` es el modelo más chico/rápido que
  // `primary` (ver config/models.yaml) — no hay un tercer tier "rápido"
  // separado, así que "el tier más rápido dentro del profile" es fallback.
  if (hints.latencyRequirement === 'low') {
    tier = 'fallback';
  }

  // 3. Presupuesto: cerca del límite diario, degrada a lo más barato
  // disponible en el profile (mismo razonamiento que el punto 2).
  if (
    hints.budgetRemaining !== undefined &&
    hints.budgetRemaining < LOW_BUDGET_REMAINING_THRESHOLD
  ) {
    tier = 'fallback';
  }

  return {
    modelId: tier === 'primary' ? profile.primary : profile.fallback,
    tier,
  };
}
