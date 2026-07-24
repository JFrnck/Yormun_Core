import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  ModelCompletionRequest,
  ModelCompletionResponse,
  SelectModelHints,
  TaskProfile,
} from '../model-provider/model-provider.types';
import { ModelRouterService } from '../model-provider/router.service';
import { estimateTokens } from './cost';
import { KillSwitchActiveError } from './errors';
import { BudgetService } from './budget.service';
import { KillSwitchService } from './kill-switch.service';

/**
 * Envuelve `ModelRouterService` sin modificarlo (docs/PROMPTS.md §4.1:
 * "sin acoplar demasiado" — ver plan de esta fase / STATUS.md). Mismo
 * método público `complete()`; los callers (Canvas, Telegram) inyectan
 * esta clase en vez de `ModelRouterService` directo.
 *
 * `sessionId` es opcional: si no se pasa, cada llamada es su propia
 * "sesión" (un UUID nuevo) — hoy ningún caller hace más de 1 llamada por
 * tarea, así que esto da el comportamiento correcto sin inventar una
 * abstracción de sesión persistente. Una tarea futura multi-llamada
 * puede compartir un `sessionId` para acumular presupuesto conjunto.
 */
@Injectable()
export class BudgetGuardedModelRouter {
  constructor(
    private readonly modelRouter: ModelRouterService,
    private readonly budgetService: BudgetService,
    private readonly killSwitchService: KillSwitchService,
  ) {}

  async complete(
    taskProfile: TaskProfile,
    request: ModelCompletionRequest,
    hints?: SelectModelHints,
    sessionId?: string,
  ): Promise<ModelCompletionResponse> {
    if (await this.killSwitchService.isActive()) {
      throw new KillSwitchActiveError(
        'todas las llamadas al ModelProvider están pausadas',
      );
    }

    const effectiveSessionId = sessionId ?? randomUUID();
    const estimatedInputTokens =
      hints?.estimatedInputTokens ?? this.estimateRequestTokens(request);

    const { budgetRemaining } = await this.budgetService.checkBeforeCall({
      sessionId: effectiveSessionId,
      estimatedInputTokens,
      maxOutputTokens: request.maxOutputTokens,
    });

    const response = await this.modelRouter.complete(taskProfile, request, {
      ...hints,
      estimatedInputTokens,
      budgetRemaining,
    });

    await this.budgetService.recordUsage({
      sessionId: effectiveSessionId,
      modelId: response.modelId,
      taskProfile,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    return response;
  }

  private estimateRequestTokens(request: ModelCompletionRequest): number {
    const systemPromptTokens = request.systemPrompt
      ? estimateTokens(request.systemPrompt)
      : 0;
    const messagesTokens = request.messages.reduce(
      (sum, message) => sum + estimateTokens(message.content),
      0,
    );
    return systemPromptTokens + messagesTokens;
  }
}
