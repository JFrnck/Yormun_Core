import { describe, expect, it } from 'vitest';
import {
  canonicalizeRow,
  computeHash,
  computeRowHash,
  GENESIS_HASH,
  verifyChain,
} from './hash-chain';

function makeRow(
  overrides: Partial<Parameters<typeof canonicalizeRow>[0]> = {},
) {
  return {
    requestId: '11111111-1111-4111-8111-111111111111',
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    actor: 'system',
    actionType: 'tool_call',
    toolName: 'readEmails',
    inputsHash: 'abc123',
    planSummary: null,
    approvalStatus: 'auto',
    approver: null,
    externalInputsSummary: null,
    ...overrides,
  };
}

describe('computeHash', () => {
  it('es determinista: mismos inputs producen el mismo hash', () => {
    const a = computeHash(GENESIS_HASH, 'contenido');
    const b = computeHash(GENESIS_HASH, 'contenido');
    expect(a).toBe(b);
  });

  it('cambia si cambia el prevHash', () => {
    const a = computeHash(GENESIS_HASH, 'contenido');
    const b = computeHash('otro-prev-hash', 'contenido');
    expect(a).not.toBe(b);
  });

  it('produce un hex sha256 de 64 caracteres', () => {
    expect(computeHash(GENESIS_HASH, 'x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyChain', () => {
  it('una cadena vacía es válida', () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });

  it('una cadena de 3 filas correctamente encadenadas es válida', () => {
    const row1 = makeRow({ requestId: 'a' });
    const hash1 = computeRowHash(GENESIS_HASH, row1);

    const row2 = makeRow({
      requestId: 'b',
      actionType: 'approval',
      approvalStatus: 'approved',
    });
    const hash2 = computeRowHash(hash1, row2);

    const row3 = makeRow({ requestId: 'c', actionType: 'tool_call' });
    const hash3 = computeRowHash(hash2, row3);

    const chain = [
      { ...row1, id: 1n, prevHash: GENESIS_HASH, currentHash: hash1 },
      { ...row2, id: 2n, prevHash: hash1, currentHash: hash2 },
      { ...row3, id: 3n, prevHash: hash2, currentHash: hash3 },
    ];

    expect(verifyChain(chain)).toEqual({ valid: true });
  });

  it('MUTACIÓN: modificar el contenido de una fila histórica rompe la cadena', () => {
    const row1 = makeRow({ requestId: 'a' });
    const hash1 = computeRowHash(GENESIS_HASH, row1);
    const row2 = makeRow({ requestId: 'b' });
    const hash2 = computeRowHash(hash1, row2);

    const chain = [
      { ...row1, id: 1n, prevHash: GENESIS_HASH, currentHash: hash1 },
      { ...row2, id: 2n, prevHash: hash1, currentHash: hash2 },
    ];

    // Ataque: cambiar approvalStatus de la fila 1 SIN recalcular su hash
    // (exactamente lo que un UPDATE malicioso haría en la tabla real).
    const tampered = [{ ...chain[0]!, approvalStatus: 'approved' }, chain[1]!];

    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(1n);
  });

  it('MUTACIÓN: borrar una fila del medio rompe el encadenamiento de la siguiente', () => {
    const row1 = makeRow({ requestId: 'a' });
    const hash1 = computeRowHash(GENESIS_HASH, row1);
    const row2 = makeRow({ requestId: 'b' });
    const hash2 = computeRowHash(hash1, row2);
    const row3 = makeRow({ requestId: 'c' });
    const hash3 = computeRowHash(hash2, row3);

    const chain = [
      { ...row1, id: 1n, prevHash: GENESIS_HASH, currentHash: hash1 },
      { ...row2, id: 2n, prevHash: hash1, currentHash: hash2 },
      { ...row3, id: 3n, prevHash: hash2, currentHash: hash3 },
    ];

    // Ataque: borrar la fila 2 — la fila 3 queda con un prevHash que ya
    // no coincide con el currentHash de lo que ahora es "la anterior".
    const withDeletion = [chain[0]!, chain[2]!];

    const result = verifyChain(withDeletion);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(3n);
  });

  it('MUTACIÓN: recalcular el hash tras el tamper no basta si el prevHash de la siguiente no se actualiza', () => {
    // Simula un atacante que SÍ recalcula currentHash de la fila tocada,
    // pero no puede propagar el cambio a prevHash de la fila siguiente
    // sin re-firmar TODA la cadena posterior — que es justamente la
    // propiedad de seguridad que se busca.
    const row1 = makeRow({ requestId: 'a' });
    const hash1 = computeRowHash(GENESIS_HASH, row1);
    const row2 = makeRow({ requestId: 'b' });
    const hash2 = computeRowHash(hash1, row2);

    const tamperedRow1 = { ...row1, approvalStatus: 'approved' };
    const tamperedHash1 = computeRowHash(GENESIS_HASH, tamperedRow1);

    const chain = [
      {
        ...tamperedRow1,
        id: 1n,
        prevHash: GENESIS_HASH,
        currentHash: tamperedHash1,
      },
      { ...row2, id: 2n, prevHash: hash1, currentHash: hash2 }, // prevHash viejo, no actualizado
    ];

    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(2n);
  });
});
