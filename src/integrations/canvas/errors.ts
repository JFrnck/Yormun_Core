import { YormunError } from '../../common/errors/yormun-error';

/**
 * Lanzado por `canvasScheduleStudyBlock` cuando se intenta programar un
 * bloque de estudio. La integración con Google Calendar está prevista para
 * la Fase 4.2 (PROMPTS.md, BLUEPRINT 7.2) — sigue el patrón ModalService
 * (Yormun_Executor/src/modal/errors.ts) con un 501 explícito.
 */
export class CalendarNotImplementedError extends YormunError {
  constructor() {
    super(
      'La integración con Google Calendar está pendiente para la Fase 4.2',
      {
        code: 'CANVAS_CALENDAR_NOT_IMPLEMENTED',
        httpStatus: 501,
      },
    );
  }
}

/**
 * Error devuelto por la API REST de Canvas LMS (errores HTTP 4xx/5xx).
 */
export class CanvasApiError extends YormunError {
  constructor(statusCode: number, message: string) {
    super(`Error en API de Canvas (${statusCode}): ${message}`, {
      code: 'CANVAS_API_ERROR',
      httpStatus: 502,
    });
  }
}

/**
 * Superado el límite estricto de tasa de Canvas (30 req/min).
 */
export class CanvasRateLimitError extends YormunError {
  constructor() {
    super('Límite de peticiones a Canvas LMS superado (máximo 30 req/min)', {
      code: 'CANVAS_RATE_LIMIT_EXCEEDED',
      httpStatus: 429,
    });
  }
}
