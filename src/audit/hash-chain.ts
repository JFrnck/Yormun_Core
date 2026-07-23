import { createHash } from 'node:crypto';

/** Hash "anterior" de la primera fila de la cadena — no hay fila previa que encadenar. */
export const GENESIS_HASH = '0'.repeat(64);

export interface HashableRow {
  readonly requestId: string;
  readonly timestamp: Date;
  readonly actor: string;
  readonly actionType: string;
  readonly toolName: string | null;
  readonly inputsHash: string;
  readonly planSummary: string | null;
  readonly approvalStatus: string;
  readonly approver: string | null;
  readonly externalInputsSummary: string | null;
}

/**
 * Serialización canónica del CONTENIDO de una fila (todo excepto
 * id/prevHash/currentHash, que no son "contenido" sino metadata de la
 * cadena). Determinista: siempre se construye el objeto con el mismo
 * orden de claves, y `JSON.stringify` preserva el orden de inserción de
 * claves string — no hace falta ordenar explícitamente.
 */
export function canonicalizeRow(row: HashableRow): string {
  return JSON.stringify({
    requestId: row.requestId,
    timestamp: row.timestamp.toISOString(),
    actor: row.actor,
    actionType: row.actionType,
    toolName: row.toolName,
    inputsHash: row.inputsHash,
    planSummary: row.planSummary,
    approvalStatus: row.approvalStatus,
    approver: row.approver,
    externalInputsSummary: row.externalInputsSummary,
  });
}

/** `current_hash = sha256(prev_hash || row_data_canonical)` — BLUEPRINT 9.5. */
export function computeHash(
  prevHash: string,
  rowDataCanonical: string,
): string {
  return createHash('sha256')
    .update(prevHash)
    .update(rowDataCanonical)
    .digest('hex');
}

export function computeRowHash(prevHash: string, row: HashableRow): string {
  return computeHash(prevHash, canonicalizeRow(row));
}

export interface ChainVerificationResult {
  readonly valid: boolean;
  /** Id de la primera fila donde la cadena deja de cuadrar, si `valid` es false. */
  readonly brokenAtId?: bigint;
}

/**
 * Verifica la cadena completa. `rows` DEBE venir ordenado ascendente por
 * `id` (responsabilidad del caller — típicamente `ORDER BY id ASC`).
 */
export function verifyChain(
  rows: readonly (HashableRow & {
    id: bigint;
    prevHash: string;
    currentHash: string;
  })[],
): ChainVerificationResult {
  let expectedPrevHash = GENESIS_HASH;

  for (const row of rows) {
    if (row.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAtId: row.id };
    }
    const expectedCurrentHash = computeRowHash(row.prevHash, row);
    if (expectedCurrentHash !== row.currentHash) {
      return { valid: false, brokenAtId: row.id };
    }
    expectedPrevHash = row.currentHash;
  }

  return { valid: true };
}
