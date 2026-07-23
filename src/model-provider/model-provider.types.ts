/**
 * Los 8 TaskProfiles definidos en `docs/MODEL_ROUTING.md` §2.1 /
 * `config/models.yaml`. Unión literal (no enum) para que un typo en un
 * profile inexistente sea un error de compilación, no de runtime.
 */
export type TaskProfile =
  | 'reasoning_heavy'
  | 'coding_default'
  | 'long_context'
  | 'extraction_fast'
  | 'chat_conversational'
  | 'code_execution_planner'
  | 'memory_consolidation'
  | 'vision_analysis';

export interface ModelProfileConfig {
  readonly description: string;
  readonly primary: string;
  readonly fallback: string;
  readonly maxTokensInput: number;
  readonly maxTokensOutput: number;
  readonly temperature: number;
}

export type ModelsConfig = Readonly<Record<TaskProfile, ModelProfileConfig>>;

/**
 * Hints del selector (`docs/MODEL_ROUTING.md` §2.2). Todos opcionales:
 * un caller que no sepa nada de contexto/latencia/presupuesto puede
 * llamar `selectModel(profiles, taskProfile)` sin el tercer argumento.
 */
export interface SelectModelHints {
  readonly estimatedInputTokens?: number;
  readonly latencyRequirement?: 'low' | 'normal';
  /** Ratio 0-1 de presupuesto diario restante (1 = nada consumido). */
  readonly budgetRemaining?: number;
}

export interface SelectedModel {
  readonly modelId: string;
  readonly tier: 'primary' | 'fallback';
}

export interface ModelMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/**
 * Forma de request/response NO especificada en los docs (verificado
 * contra `docs/MODEL_ROUTING.md` — solo describen el selector, no la
 * llamada de completion en sí). Es una decisión de diseño propia,
 * documentada en el plan de esta sesión, no en un ADR — no es una
 * decisión de seguridad, es un contrato interno entre `router.service.ts`
 * y los providers.
 */
export interface ModelCompletionRequest {
  readonly systemPrompt?: string;
  readonly messages: readonly ModelMessage[];
  readonly maxOutputTokens: number;
  readonly temperature: number;
}

export interface ModelCompletionResponse {
  readonly content: string;
  readonly modelId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ModelProviderClient {
  readonly vendor: 'anthropic' | 'google';
  complete(
    modelId: string,
    request: ModelCompletionRequest,
  ): Promise<ModelCompletionResponse>;
}
