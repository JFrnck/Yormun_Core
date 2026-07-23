import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadModelsConfig, parseModelsConfig } from './models-config.schema';

function validRawProfile(overrides: Record<string, unknown> = {}) {
  return {
    description: 'x',
    primary: 'claude-opus-4-8',
    fallback: 'claude-sonnet-5',
    max_tokens_input: 100_000,
    max_tokens_output: 4000,
    temperature: 0.3,
    ...overrides,
  };
}

function validRawConfig(
  profileOverrides: Record<string, unknown> = {},
): unknown {
  const profile = validRawProfile(profileOverrides);
  return {
    profiles: {
      reasoning_heavy: profile,
      coding_default: profile,
      long_context: profile,
      extraction_fast: profile,
      chat_conversational: profile,
      code_execution_planner: profile,
      memory_consolidation: profile,
      vision_analysis: profile,
    },
  };
}

describe('parseModelsConfig', () => {
  it('traduce snake_case del YAML a camelCase de ModelProfileConfig', () => {
    const config = parseModelsConfig(validRawConfig());
    expect(config.reasoning_heavy).toEqual({
      description: 'x',
      primary: 'claude-opus-4-8',
      fallback: 'claude-sonnet-5',
      maxTokensInput: 100_000,
      maxTokensOutput: 4000,
      temperature: 0.3,
    });
  });

  it('lanza si falta uno de los 8 profiles requeridos', () => {
    const raw = validRawConfig() as { profiles: Record<string, unknown> };
    delete raw.profiles.vision_analysis;

    expect(() => parseModelsConfig(raw)).toThrow(
      /config\/models\.yaml inválido/,
    );
  });

  it('lanza si un profile tiene un campo con tipo incorrecto', () => {
    const raw = validRawConfig({ temperature: 'no-es-un-numero' });

    expect(() => parseModelsConfig(raw)).toThrow(
      /config\/models\.yaml inválido/,
    );
  });

  it('lanza si primary/fallback están vacíos', () => {
    const raw = validRawConfig({ primary: '' });

    expect(() => parseModelsConfig(raw)).toThrow();
  });

  it('lanza si el input no tiene la forma esperada en absoluto', () => {
    expect(() => parseModelsConfig({ nada_que_ver: true })).toThrow();
    expect(() => parseModelsConfig(null)).toThrow();
  });
});

describe('loadModelsConfig', () => {
  it('carga y valida el config/models.yaml real del repo sin lanzar', () => {
    const realPath = join(process.cwd(), 'config', 'models.yaml');
    const config = loadModelsConfig(realPath);

    // No repite los 8 profiles completos (ya cubierto arriba) — solo
    // confirma que el archivo real en disco matchea el schema y trae al
    // menos el profile que usa Fase 3.1 (Canvas/shadowing).
    expect(config.long_context.primary).toBe('gemini-3.1-pro');
  });
});
