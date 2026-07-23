import { Inject, Injectable } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.provider';
import { MODELS_CONFIG } from './model-provider.tokens';
import type {
  ModelCompletionRequest,
  ModelCompletionResponse,
  ModelProviderClient,
  ModelsConfig,
  SelectModelHints,
  TaskProfile,
} from './model-provider.types';
import { UnknownModelVendorError } from './errors';
import { FailoverService } from './failover.service';
import { GoogleProvider } from './google.provider';
import { selectModel } from './router.logic';

/**
 * `ModelRouterService` (docs/MODEL_ROUTING.md §2 — el módulo se llama
 * `router.ts` en la doc; acá sigue la convención `.service.ts` del resto
 * del repo para servicios inyectables, ej. `audit.service.ts`).
 * Une el selector puro (`selectModel`, §2.2) con el failover real (§2.3):
 * elige el primer candidato según los hints, y si falla, cae al otro
 * modelo definido en el mismo profile (sea cual sea el rol — primary o
 * fallback — que `selectModel` no haya elegido ya).
 */
@Injectable()
export class ModelRouterService {
  constructor(
    @Inject(MODELS_CONFIG) private readonly profiles: ModelsConfig,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly googleProvider: GoogleProvider,
    private readonly failoverService: FailoverService,
  ) {}

  async complete(
    taskProfile: TaskProfile,
    request: ModelCompletionRequest,
    hints?: SelectModelHints,
  ): Promise<ModelCompletionResponse> {
    const selected = selectModel(this.profiles, taskProfile, hints);
    const profile = this.profiles[taskProfile];
    const secondaryModelId =
      selected.modelId === profile.primary ? profile.fallback : profile.primary;

    return this.failoverService.executeWithFailover(
      {
        taskProfile,
        primaryModelId: selected.modelId,
        fallbackModelId: secondaryModelId,
      },
      () =>
        this.providerFor(selected.modelId).complete(selected.modelId, request),
      () =>
        this.providerFor(secondaryModelId).complete(secondaryModelId, request),
    );
  }

  private providerFor(modelId: string): ModelProviderClient {
    if (modelId.startsWith('claude-')) {
      return this.anthropicProvider;
    }
    if (modelId.startsWith('gemini-')) {
      return this.googleProvider;
    }
    throw new UnknownModelVendorError(modelId);
  }
}
