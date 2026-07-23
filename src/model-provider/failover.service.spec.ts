import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllProvidersFailedError } from './errors';
import { FailoverService } from './failover.service';

const CONTEXT = {
  taskProfile: 'coding_default',
  primaryModelId: 'claude-sonnet-5',
  fallbackModelId: 'gemini-3.5-flash',
};

describe('FailoverService.executeWithFailover', () => {
  let service: FailoverService;

  beforeEach(() => {
    service = new FailoverService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve el resultado del primary si funciona al primer intento', async () => {
    const callPrimary = vi.fn().mockResolvedValue('ok-primary');
    const callFallback = vi.fn();

    const result = await service.executeWithFailover(
      CONTEXT,
      callPrimary,
      callFallback,
    );

    expect(result).toBe('ok-primary');
    expect(callPrimary).toHaveBeenCalledTimes(1);
    expect(callFallback).not.toHaveBeenCalled();
  });

  it('reintenta 1 vez el primary antes de rendirse (docs/MODEL_ROUTING.md 2.3)', async () => {
    const callPrimary = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce('ok-en-el-reintento');
    const callFallback = vi.fn();

    const resultPromise = service.executeWithFailover(
      CONTEXT,
      callPrimary,
      callFallback,
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('ok-en-el-reintento');
    expect(callPrimary).toHaveBeenCalledTimes(2);
    expect(callFallback).not.toHaveBeenCalled();
  });

  it('cambia al fallback si el primary falla incluso tras el reintento', async () => {
    const callPrimary = vi.fn().mockRejectedValue(new Error('5xx'));
    const callFallback = vi.fn().mockResolvedValue('ok-fallback');

    const resultPromise = service.executeWithFailover(
      CONTEXT,
      callPrimary,
      callFallback,
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('ok-fallback');
    expect(callPrimary).toHaveBeenCalledTimes(2);
    expect(callFallback).toHaveBeenCalledTimes(1);
  });

  it('lanza AllProvidersFailedError si tanto el primary como el fallback fallan', async () => {
    const callPrimary = vi.fn().mockRejectedValue(new Error('primary caído'));
    const callFallback = vi.fn().mockRejectedValue(new Error('fallback caído'));

    const resultPromise = service.executeWithFailover(
      CONTEXT,
      callPrimary,
      callFallback,
    );
    // Marca la promesa como "manejada" de inmediato — de lo contrario
    // Vitest reporta un unhandled rejection porque rechaza durante
    // runAllTimersAsync(), antes de que el try/catch de abajo llegue a
    // hacerle await.
    resultPromise.catch(() => {});
    await vi.runAllTimersAsync();

    let caught: unknown;
    try {
      await resultPromise;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AllProvidersFailedError);
    expect((caught as AllProvidersFailedError).code).toBe(
      'MODEL_PROVIDER_ALL_FAILED',
    );
  });
});
