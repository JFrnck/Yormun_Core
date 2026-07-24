import type { ModelPrices } from '../model-provider/model-provider.types';

// Heurística estándar (≈4 caracteres por token en inglés/español) para
// estimar el input ANTES de llamar al modelo real — no hay forma exacta
// de saber el conteo de tokens sin un tokenizer por vendor, y el guard
// necesita un número ANTES de gastar la llamada real (BLUEPRINT 9.6:
// "verifica presupuesto antes"). Se documenta como aproximación, nunca
// se usa para facturación real (eso viene de `ModelCompletionResponse`,
// tokens reales devueltos por el provider).
const CHARS_PER_TOKEN_ESTIMATE = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Costo real en USD de una llamada ya resuelta, usando los tokens
 * reales de `ModelCompletionResponse` (no la estimación de arriba).
 * Un modelId sin precio en `config/models.yaml` → `model_prices` es un
 * error de configuración real (MODEL_ROUTING.md 6.1: "todo modelo pasa
 * por el ModelProvider" — incluye su precio), no un 0 silencioso.
 */
export function computeCostUsd(
  prices: ModelPrices,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = prices[modelId];
  if (!price) {
    throw new Error(
      `No hay precio configurado para el modelo "${modelId}" en config/models.yaml (model_prices).`,
    );
  }

  const inputCost = (inputTokens / 1_000_000) * price.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * price.outputPerMillion;
  return inputCost + outputCost;
}
