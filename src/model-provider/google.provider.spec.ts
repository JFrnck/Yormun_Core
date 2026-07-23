import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../config';
import { GoogleProvider } from './google.provider';

// AGENTS.md 6.3: mockear la API externa (el SDK de Google GenAI).
const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));

const fakeConfigService = {
  get: vi.fn().mockReturnValue('fake-gemini-key'),
} as unknown as AppConfigService;

describe('GoogleProvider.complete', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  it('mapea .text y usageMetadata a la forma común de ModelCompletionResponse', async () => {
    generateContentMock.mockResolvedValue({
      text: 'hola desde Gemini',
      modelVersion: 'gemini-3.1-pro-001',
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 21 },
    });

    const provider = new GoogleProvider(fakeConfigService);
    const result = await provider.complete('gemini-3.1-pro', {
      messages: [{ role: 'user', content: 'hola' }],
      maxOutputTokens: 100,
      temperature: 0.4,
    });

    expect(result).toEqual({
      content: 'hola desde Gemini',
      modelId: 'gemini-3.1-pro-001',
      inputTokens: 7,
      outputTokens: 21,
    });
    expect(generateContentMock).toHaveBeenCalledWith({
      model: 'gemini-3.1-pro',
      contents: [{ role: 'user', parts: [{ text: 'hola' }] }],
      config: {
        systemInstruction: undefined,
        maxOutputTokens: 100,
        temperature: 0.4,
      },
    });
  });

  it('convierte el rol "assistant" a "model" (convención de Gemini)', async () => {
    generateContentMock.mockResolvedValue({
      text: 'ok',
      modelVersion: 'gemini-3.1-pro-001',
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    });

    const provider = new GoogleProvider(fakeConfigService);
    await provider.complete('gemini-3.1-pro', {
      messages: [
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: 'hola de vuelta' },
      ],
      maxOutputTokens: 100,
      temperature: 0.4,
    });

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          { role: 'user', parts: [{ text: 'hola' }] },
          { role: 'model', parts: [{ text: 'hola de vuelta' }] },
        ],
      }),
    );
  });

  it('usa 0 como default de tokens si la respuesta no trae usageMetadata', async () => {
    generateContentMock.mockResolvedValue({
      text: 'ok',
      modelVersion: undefined,
    });

    const provider = new GoogleProvider(fakeConfigService);
    const result = await provider.complete('gemini-3.1-pro', {
      messages: [{ role: 'user', content: 'hola' }],
      maxOutputTokens: 100,
      temperature: 0.4,
    });

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.modelId).toBe('gemini-3.1-pro');
  });

  it('incluye systemInstruction solo cuando systemPrompt está definido', async () => {
    generateContentMock.mockResolvedValue({
      text: 'ok',
      modelVersion: 'gemini-3.1-pro-001',
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    });

    const provider = new GoogleProvider(fakeConfigService);
    await provider.complete('gemini-3.1-pro', {
      systemPrompt: 'sos un asistente académico',
      messages: [{ role: 'user', content: 'hola' }],
      maxOutputTokens: 100,
      temperature: 0.4,
    });

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          systemInstruction: 'sos un asistente académico',
          maxOutputTokens: 100,
          temperature: 0.4,
        },
      }),
    );
  });
});
