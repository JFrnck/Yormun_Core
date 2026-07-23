import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema';
import { CanvasClientService } from './canvas-client.service';
import { CanvasApiError, CanvasRateLimitError } from './errors';

describe('CanvasClientService', () => {
  let service: CanvasClientService;

  beforeEach(() => {
    const mockConfigService: Partial<ConfigService<Env, true>> = {
      get: (key: keyof Env) => {
        if (key === 'CANVAS_BASE_URL')
          return 'https://canvas.test.instructure.com';
        if (key === 'CANVAS_API_TOKEN') return 'test-token-123';
        return undefined;
      },
    };

    service = new CanvasClientService(
      mockConfigService as ConfigService<Env, true>,
    );
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debe obtener la lista de cursos activos', async () => {
    const mockCourses = [{ id: 101, name: 'Matemáticas Avanzadas' }];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCourses),
    } as Response);

    const courses = await service.getActiveCourses();
    expect(courses).toEqual(mockCourses);
    expect(fetch).toHaveBeenCalledWith(
      'https://canvas.test.instructure.com/api/v1/courses?enrollment_state=active&per_page=50',
      {
        headers: {
          Authorization: 'Bearer test-token-123',
          Accept: 'application/json',
        },
      },
    );
  });

  it('debe obtener las tareas próximas', async () => {
    const mockAssignments = [
      {
        id: 1,
        name: 'Tarea 1',
        course_id: 101,
        due_at: '2026-08-01T23:59:00Z',
      },
    ];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockAssignments),
    } as Response);

    const assignments = await service.getUpcomingAssignments(101);
    expect(assignments).toEqual(mockAssignments);
    expect(fetch).toHaveBeenCalledWith(
      'https://canvas.test.instructure.com/api/v1/courses/101/assignments?bucket=upcoming&per_page=50',
      expect.any(Object),
    );
  });

  it('debe lanzar CanvasApiError cuando Canvas responde con error HTTP', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as Response);

    await expect(service.getActiveCourses()).rejects.toThrow(CanvasApiError);
  });

  it('debe aplicar el rate limit estricto de 30 req/min', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    // Hacer 30 peticiones exitosas
    for (let i = 0; i < 30; i++) {
      await service.getActiveCourses();
    }

    // La petición 31 debe lanzar CanvasRateLimitError
    await expect(service.getActiveCourses()).rejects.toThrow(
      CanvasRateLimitError,
    );
  });
});
