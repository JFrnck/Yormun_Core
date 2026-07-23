import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../config';
import type {
  ModelCompletionRequest,
  ModelCompletionResponse,
  ModelProviderClient,
} from './model-provider.types';

@Injectable()
export class GoogleProvider implements ModelProviderClient {
  readonly vendor = 'google' as const;

  private readonly client: GoogleGenAI;

  constructor(@Inject(ConfigService) configService: AppConfigService) {
    this.client = new GoogleGenAI({
      apiKey: configService.get('GEMINI_API_KEY'),
    });
  }

  async complete(
    modelId: string,
    request: ModelCompletionRequest,
  ): Promise<ModelCompletionResponse> {
    const response = await this.client.models.generateContent({
      model: modelId,
      contents: request.messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      config: {
        // Mismo motivo que en anthropic.provider.ts: exactOptionalPropertyTypes
        // no acepta `systemInstruction: undefined` explícito.
        ...(request.systemPrompt !== undefined
          ? { systemInstruction: request.systemPrompt }
          : {}),
        maxOutputTokens: request.maxOutputTokens,
        temperature: request.temperature,
      },
    });

    return {
      content: response.text ?? '',
      modelId: response.modelVersion ?? modelId,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
