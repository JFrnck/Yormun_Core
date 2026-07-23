import { pgTable, bigserial, uuid, timestamp, text } from 'drizzle-orm/pg-core';

/**
 * Log de auditoría inmutable (BLUEPRINT 9.5, ADR 0002). INSERT-ONLY:
 * ninguna fila se actualiza jamás — cada transición de estado de una
 * acción (pending → approved/rejected/timeout/abandoned) es una fila
 * NUEVA que comparte `requestId` con la fila que la originó. Modificar
 * una fila histórica invalida su hash y el de toda la cadena posterior
 * (AGENTS.md 5.6: "es un incidente de seguridad").
 */
export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  requestId: uuid('request_id').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true })
    .notNull()
    .defaultNow(),
  actor: text('actor').notNull(),
  actionType: text('action_type').notNull(),
  toolName: text('tool_name'),
  inputsHash: text('inputs_hash').notNull(),
  planSummary: text('plan_summary'),
  approvalStatus: text('approval_status').notNull(),
  approver: text('approver'),
  externalInputsSummary: text('external_inputs_summary'),
  prevHash: text('prev_hash').notNull(),
  currentHash: text('current_hash').notNull(),
});

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;

/**
 * Estado mutable de una aprobación en curso (ADR 0002). Vive aparte de
 * `audit_log` precisamente porque SÍ se actualiza mientras la aprobación
 * está pendiente (ej. registrar la primera confirmación de un
 * dual-confirm). Se borra al escribir la fila terminal en audit_log.
 * Persistida (no en memoria): sobrevive a un restart del pod de core.
 */
export const pendingApprovals = pgTable('pending_approvals', {
  requestId: uuid('request_id').primaryKey(),
  toolName: text('tool_name').notNull(),
  level: text('level').notNull(), // 'confirm' | 'dual-confirm'
  inputsHash: text('inputs_hash').notNull(),
  planSummary: text('plan_summary'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  firstApprovedAt: timestamp('first_approved_at', { withTimezone: true }),
  firstApprover: text('first_approver'),
  // Solo relevante para dual-confirm: la segunda aprobación no se acepta
  // antes de este instante (BLUEPRINT 9.2, ≥30s tras la primera).
  availableAt: timestamp('available_at', { withTimezone: true }),
  // Timestamp del primer aviso de escalamiento (BLUEPRINT 9.4, tools con
  // deadline: aviso a las 12h). Evita que timeout.service reenvíe el
  // mismo aviso en cada barrido mientras espera las 24h de abandono.
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
});

export type PendingApprovalRow = typeof pendingApprovals.$inferSelect;
export type NewPendingApprovalRow = typeof pendingApprovals.$inferInsert;
