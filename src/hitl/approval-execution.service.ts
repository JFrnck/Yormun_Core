import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  DualConfirmService,
  PendingApprovalNotFoundError,
} from './dual-confirm.service';
import { ToolExecutorRegistry } from './tool-executor.registry';

export interface ResolveAndExecuteAwaitingSecond {
  readonly outcome: 'awaiting-second';
}

export interface ResolveAndExecuteResolved {
  readonly outcome: 'resolved';
  readonly toolName: string;
  readonly result: unknown;
}

export type ResolveAndExecuteResult =
  ResolveAndExecuteAwaitingSecond | ResolveAndExecuteResolved;

/**
 * Orquesta la mitad "aprobar → ejecutar" del ciclo HITL para tools
 * `confirm`/`dual-confirm` (prerequisito de Fase 4.2, ver STATUS.md).
 * Antes de esto, `TelegramBotService` orquestaba `DualConfirmService` +
 * `AuditService` a mano y nunca invocaba la acción real de ningún tool —
 * este servicio centraliza eso y agrega el paso de ejecución que faltaba.
 */
@Injectable()
export class ApprovalExecutionService {
  constructor(
    private readonly dualConfirmService: DualConfirmService,
    private readonly auditService: AuditService,
    private readonly toolExecutorRegistry: ToolExecutorRegistry,
  ) {}

  /**
   * Puede lanzar `PendingApprovalNotFoundError` o
   * `SecondApprovalTooEarlyError` (propagadas tal cual desde
   * `DualConfirmService.recordApproval`). Solo ejecuta la acción real
   * (`ToolExecutorRegistry.execute`) cuando el outcome es `'resolved'` —
   * la primera aprobación de un dual-confirm nunca ejecuta nada.
   */
  async resolveAndExecute(
    requestId: string,
    approver: string,
  ): Promise<ResolveAndExecuteResult> {
    const pending = await this.dualConfirmService.getPending(requestId);
    if (!pending) {
      throw new PendingApprovalNotFoundError(requestId);
    }

    const outcome = await this.dualConfirmService.recordApproval(
      requestId,
      approver,
    );

    if (outcome === 'awaiting-second') {
      return { outcome: 'awaiting-second' };
    }

    const result = await this.toolExecutorRegistry.execute(
      pending.toolName,
      pending.payload,
    );

    await this.auditService.recordApproval({
      requestId,
      approver,
      toolName: pending.toolName,
      inputsHash: pending.inputsHash,
    });

    await this.dualConfirmService.removePending(requestId);

    return { outcome: 'resolved', toolName: pending.toolName, result };
  }

  /** Rechazar nunca ejecuta la acción — solo audita y limpia el pendiente. */
  async resolveRejection(requestId: string, approver: string): Promise<void> {
    const pending = await this.dualConfirmService.getPending(requestId);
    if (!pending) {
      throw new PendingApprovalNotFoundError(requestId);
    }

    await this.auditService.recordRejection({
      requestId,
      approver,
      toolName: pending.toolName,
      inputsHash: pending.inputsHash,
    });

    await this.dualConfirmService.removePending(requestId);
  }
}
