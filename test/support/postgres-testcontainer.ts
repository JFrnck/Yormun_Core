import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { Pool } from 'pg';
import * as schema from '../../src/db/schema';

// Pinneado (nunca `latest`), Postgres 16 como el resto del stack
// (BLUEPRINT 3.3). No usa pgvector aquí: HITL/audit no tocan esa
// extensión, y el testcontainer genérico basta.
const POSTGRES_IMAGE = 'postgres:16.14-alpine';

export interface TestDb {
  pool: Pool;
  db: ReturnType<typeof drizzle<typeof schema>>;
  container: StartedPostgreSqlContainer;
  stop: () => Promise<void>;
}

/**
 * Levanta un Postgres real (testcontainers, AGENTS.md 6.2), aplica las
 * migraciones de Drizzle, y devuelve un cliente listo para usar.
 * Pensado para `beforeAll` en specs de integración.
 */
export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../../drizzle'),
  });

  return {
    pool,
    db,
    container,
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}
