import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../config';
import { AnthropicProvider } from './anthropic.provider';

// AGENTS.md 6.3: mockear la API externa (el SDK de Anthropic), nunca la
// lógica propia. Vitest sube `vi.mock` por encima de los imports
// automáticamente, así que el mock aplica antes de que AnthropicProvider
// construya el cliente real.
const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
  },
}));

const fakeConfigService = {
  get: vi.fn().mockReturnValue('fake-anthropic-key'),
} as unknown as AppConfigService;

describe('AnthropicProvider.complete', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('mapea el primer bloque de texto de la respuesta y los tokens de uso', async () => {
    createMock.mockResolvedValue({
      model: 'claude-sonnet-5',
      content: [{ type: 'text', text: 'hola desde Claude' }],
      usage: { input_tokens: 12, output_tokens: 34 },
    });

    const provider = new AnthropicProvider(fakeConfigService);
    const result = await provider.complete('claude-sonnet-5', {
      messages: [{ role: 'user', content: 'hola' }],
      maxOutputTokens: 100,
      temperature: 0.2,
    });

    expect(result).toEqual({
      content: 'hola desde Claude',
      modelId: 'claude-sonnet-5',
      inputTokens: 12,
      outputTokens: 34,
    });
    expect(createMock).toHaveBeenCalledWith({
      model: 'claude-sonnet-5',
      max_tokens: 100,
      temperature: 0.2,
      system: undefined,
      messages: [{ role: 'user', content: 'hola' }],
    });
  });

  it('devuelve string vacío si la respuesta no trae ningún bloque de texto', async () => {
    createMock.mockResolvedValue({
      model: 'claude-sonnet-5',
      content: [{ type: 'tool_use' }],
      usage: { input_tokens: 5, output_tokens: 0 },
    });

    const provider = new AnthropicProvider(fakeConfigService);
    const result = await provider.complete('claude-sonnet-5', {
      messages: [{ role: 'user', content: 'hola' }],
      maxOutputTokens: 100,
      temperature: 0.2,
    });

    expect(result.content).toBe('');
  });

  it('incluye system solo cuando systemPrompt está definido', async () => {
    createMock.mockResolvedValue({
      model: 'claude-sonnet-5',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const provider = new AnthropicProvider(fakeConfigService);
    await provider.complete('claude-sonnet-5', {
      systemPrompt: 'sos un asistente académico',
      messages: [{ role: 'user', content: 'hola' }],
      maxOutputTokens: 100,
      temperature: 0.2,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'sos un asistente académico' }),
    );
  });
});
