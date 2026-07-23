import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../config';
import type {
  ModelCompletionRequest,
  ModelCompletionResponse,
  ModelProviderClient,
} from './model-provider.types';

@Injectable()
export class AnthropicProvider implements ModelProviderClient {
  readonly vendor = 'anthropic' as const;

  private readonly client: Anthropic;

  // `@Inject(ConfigService)` explícito: permite tipar el parámetro como
  // el alias `AppConfigService` (get() estricto por Env) sin romper la
  // resolución de DI de Nest, que de otro modo depende del tipo
  // reflejado del constructor (mismo problema encontrado y documentado
  // en Yormun_Executor/src/k8s/k8s.service.ts).
  constructor(@Inject(ConfigService) configService: AppConfigService) {
    this.client = new Anthropic({
      apiKey: configService.get('ANTHROPIC_API_KEY'),
    });
  }

  async complete(
    modelId: string,
    request: ModelCompletionRequest,
  ): Promise<ModelCompletionResponse> {
    const response = await this.client.messages.create({
      model: modelId,
      max_tokens: request.maxOutputTokens,
      temperature: request.temperature,
      // Spread condicional, no `system: request.systemPrompt`: con
      // `exactOptionalPropertyTypes`, el SDK distingue "la clave está
      // ausente" de "la clave está presente con valor undefined", y su
      // tipo (`string | TextBlockParam[]`) no acepta lo segundo.
      ...(request.systemPrompt !== undefined
        ? { system: request.systemPrompt }
        : {}),
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );

    return {
      content: textBlock?.text ?? '',
      modelId: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
