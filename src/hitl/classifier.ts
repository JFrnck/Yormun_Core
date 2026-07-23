import { randomUUID } from 'node:crypto';
import { getToolDefinition } from '../tools/registry';
import { UnknownToolError } from './errors';
import { approvalsRequiredFor, type HitlDecision } from './types';

/**
 * Clasifica una llamada a tool según su `hitlLevel` ESTÁTICO (ADR 0001).
 *
 * `inputs` se acepta por la firma (BLUEPRINT 9.3, para poder computar el
 * hash de auditoría en el caller) pero HOY no influye el nivel — el nivel
 * depende únicamente del registry. Se documenta explícito para que un
 * futuro lector no asuma que "inputs" habilita algún tipo de escalamiento
 * dinámico: eso es exactamente lo que AGENTS.md 5.4 prohíbe.
 */
export function classifyToolCall(
  toolName: string,
  _inputs: unknown,
): HitlDecision {
  const tool = getToolDefinition(toolName);
  if (!tool) {
    throw new UnknownToolError(toolName);
  }

  return {
    requestId: randomUUID(),
    toolName: tool.name,
    level: tool.hitlLevel,
    approvalsRequired: approvalsRequiredFor(tool.hitlLevel),
    notifyAfterExecution: tool.hitlLevel === 'notify',
  };
}
