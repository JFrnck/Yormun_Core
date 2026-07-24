import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../audit/audit.service';
import type { BudgetGuardedModelRouter } from '../../budget/budget-guarded-router.service';
import type { CanvasClientService } from './canvas-client.service';
import { ShadowingService } from './shadowing.service';

describe('ShadowingService', () => {
  let service: ShadowingService;
  let mockCanvasClient: Partial<CanvasClientService>;
  let mockModelRouter: Partial<BudgetGuardedModelRouter>;
  let mockAuditService: Partial<AuditService>;

  beforeEach(() => {
    mockCanvasClient = {
      getActiveCourses: vi
        .fn()
        .mockResolvedValue([{ id: 101, name: 'Física I' }]),
      getUpcomingAssignments: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Lab 1',
          course_id: 101,
          due_at: '2026-07-25T23:59:00Z',
        },
      ]),
      getCourseAnnouncements: vi.fn().mockResolvedValue([
        {
          id: 2,
          title: 'Cambio de aula',
          message: 'Clase en Aula 302',
          posted_at: '2026-07-23',
        },
      ]),
    };

    mockModelRouter = {
      complete: vi.fn().mockResolvedValue({
        content: '# Resumen Académico\n\n- Lab 1 vence el 25 de julio.',
        modelId: 'gemini-3.1-pro',
        inputTokens: 500,
        outputTokens: 100,
      }),
    };

    mockAuditService = {
      recordToolCall: vi.fn().mockResolvedValue(undefined),
    };

    service = new ShadowingService(
      mockCanvasClient as CanvasClientService,
      mockModelRouter as BudgetGuardedModelRouter,
      mockAuditService as AuditService,
    );
  });

  it('runShadowing debe consultar Canvas, envolver el contenido, solicitar resumen a ModelRouterService en long_context y registrar auditoría', async () => {
    const result = await service.runShadowing();

    expect(result.coursesChecked).toBe(1);
    expect(result.recentAnnouncementsCount).toBe(1);
    expect(result.upcomingAssignmentsCount).toBe(1);
    expect(result.summaryMarkdown).toContain('# Resumen Académico');
    expect(result.modelId).toBe('gemini-3.1-pro');

    const expectedContentMatcher: unknown = expect.stringMatching(
      /<untrusted_content_[0-9a-f]{16} source="canvas_shadowing">/,
    );

    // Verificar que ModelRouter.complete fue llamado con profile 'long_context' y los parámetros correctos
    expect(mockModelRouter.complete).toHaveBeenCalledWith(
      'long_context',
      expect.objectContaining({
        maxOutputTokens: 8000,
        temperature: 0.4,
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expectedContentMatcher,
          }),
        ],
      }),
    );

    // Verificar que se registró la auditoría
    expect(mockAuditService.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'canvas_shadowing_cron',
        approvalStatus: 'auto',
        externalInputsSummary:
          'Shadowing: 1 cursos, 1 anuncios, 1 entregables próximos.',
      }),
    );
  });
});
