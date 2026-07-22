import type { HitlLevel } from '../hitl/types';

/**
 * Declaración estática del `hitlLevel` de cada tool (BLUEPRINT 9.3,
 * AGENTS.md 5.4). ESTE es el único lugar donde un nivel se asigna a una
 * tool. El LLM jamás decide esto en runtime; cambiarlo requiere PR con
 * revisión humana + dual-confirm (AGENTS.md 5.4).
 */
export interface ToolDefinition {
  readonly name: string;
  readonly hitlLevel: HitlLevel;
  readonly description: string;
  /**
   * Solo aplica si `hitlLevel` es 'confirm'/'dual-confirm' (BLUEPRINT 9.4):
   * qué hace timeout.service cuando la aprobación expira sin respuesta.
   * 'discard' = reversible/informativo, se descarta y se notifica.
   * 'escalate' = tiene deadline externo, se escala a las 12h y se marca
   * 'abandoned' a las 24h. Ausente para tools 'auto'/'notify' (no aplica).
   */
  readonly timeoutBehavior?: 'discard' | 'escalate';
}

// `as const` es solo un contrato de tipos — Object.freeze es lo que da la
// garantía real en runtime de que nadie muta el registry (defensa en
// profundidad: "el hitlLevel jamás se decide en runtime" también aplica
// a que un `as any` no pueda colarse un .push()).
const TOOL_REGISTRY: readonly ToolDefinition[] = Object.freeze([
  Object.freeze({
    name: 'readEmails',
    hitlLevel: 'auto',
    description:
      'Lee correos del usuario. Solo lectura, sin efectos secundarios.',
  }),
  Object.freeze({
    name: 'createCalendarEvent',
    hitlLevel: 'notify',
    description:
      'Crea un evento en Google Calendar. Se ejecuta y se notifica después.',
  }),
  Object.freeze({
    name: 'sendEmail',
    hitlLevel: 'confirm',
    description:
      'Envía un correo en nombre del usuario. Requiere 1 aprobación.',
    // Reversible/informativo (BLUEPRINT 9.4, ejemplo explícito: "responder
    // correo"): al expirar se descarta y se notifica, no se escala.
    timeoutBehavior: 'discard',
  }),
] satisfies ToolDefinition[]);

const TOOL_REGISTRY_BY_NAME: ReadonlyMap<string, ToolDefinition> = new Map(
  TOOL_REGISTRY.map((tool) => [tool.name, tool]),
);

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY_BY_NAME.get(name);
}

export function listRegisteredTools(): readonly ToolDefinition[] {
  return TOOL_REGISTRY;
}
