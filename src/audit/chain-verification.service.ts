import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { asc } from 'drizzle-orm';
import { DB_CONNECTION, type Db } from '../db/db.module';
import { auditLog } from '../db/schema';
import { type ChainVerificationResult, verifyChain } from './hash-chain';

/**
 * Verificación diaria de la cadena completa (BLUEPRINT 9.5). Si detecta
 * corrupción, bloquea nuevas escrituras (`isLocked()`, consultado por
 * AuditService) hasta intervención manual — regla de oro: un audit log
 * corrupto es peor que uno detenido.
 */
@Injectable()
export class ChainVerificationService {
  private readonly logger = new Logger(ChainVerificationService.name);
  private locked = false;

  constructor(@Inject(DB_CONNECTION) private readonly db: Db) {}

  isLocked(): boolean {
    return this.locked;
  }

  /** Solo para tests/runbooks de recuperación manual — nunca se llama desde código de negocio. */
  unlock(): void {
    this.locked = false;
  }

  @Cron('0 4 * * *')
  async verifyDaily(): Promise<ChainVerificationResult> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .orderBy(asc(auditLog.id));
    const result = verifyChain(rows);

    if (!result.valid) {
      this.locked = true;
      this.logger.error(
        `Audit chain CORRUPTA en la fila id=${String(result.brokenAtId)}. Escritura bloqueada hasta intervención manual.`,
      );
      // Alerta Telegram real: Fase 2.4 (bot grammY). Por ahora solo el log.
    } else {
      this.logger.log(`Audit chain verificada: ${rows.length} filas, OK.`);
    }

    return result;
  }
}
