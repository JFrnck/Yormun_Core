import { z } from 'zod';

// Única fuente de verdad de qué variables de entorno existen y su forma
// (AGENTS.md 8.4). Nada más en el repo debe leer `process.env` directo.
export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL es requerida (postgres://user:pass@host:port/db)'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Usado como `validate` de `ConfigModule.forRoot` — Nest lo llama al
 * arrancar con `process.env` crudo. Si falla, lanza y el proceso muere en
 * el startup con un mensaje claro (AGENTS.md 8.4), antes de que cualquier
 * módulo llegue a usar una variable ausente o mal formada.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${issues}`);
  }
  return result.data;
}
