-- Down migration de 0001_wandering_demogoblin — aplicada por
-- `pnpm db:migrate:down` (drizzle-kit no genera rollbacks: AGENTS.md 1.2
-- exige up/down explícitos, así que este archivo se mantiene a mano en
-- espejo del .sql de arriba).
DROP TABLE IF EXISTS "budget_kill_switch";
--> statement-breakpoint
DROP TABLE IF EXISTS "budget_hourly_usage";
--> statement-breakpoint
DROP TABLE IF EXISTS "budget_daily_usage";
