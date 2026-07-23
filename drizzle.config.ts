import { defineConfig } from 'drizzle-kit';

// DATABASE_URL solo se lee aquí para drizzle-kit (herramienta de CLI,
// fuera del proceso de la app) — el runtime de la app pasa siempre por
// src/config (AGENTS.md 8.4).
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL es requerida para drizzle-kit (generate/migrate).');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
});
