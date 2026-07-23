-- Down migration de 0000_init_audit_log — aplicada por
-- `pnpm db:migrate:down` (drizzle-kit no genera rollbacks: AGENTS.md 1.2
-- exige up/down explícitos, así que este archivo se mantiene a mano en
-- espejo del .sql de arriba).
DROP TABLE IF EXISTS "pending_approvals";
--> statement-breakpoint
DROP TABLE IF EXISTS "audit_log";
